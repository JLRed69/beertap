package com.redtapp.beertap

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.util.UUID
import kotlin.concurrent.thread

/** Bluetooth clásico (SPP) hacia el ESP32 "BeerTap-…". Reconecta solo. */
class BtLink(private val onLine: (String) -> Unit) {
    @Volatile var connected = false
    @Volatile private var running = false
    private var sock: BluetoothSocket? = null
    private var out: OutputStream? = null
    private val spp: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    fun start() {
        if (running) return
        running = true
        thread(isDaemon = true, name = "beertap-bt") { loop() }
    }

    fun stop() {
        running = false
        try { sock?.close() } catch (e: Exception) {}
    }

    private fun loop() {
        val ad = BluetoothAdapter.getDefaultAdapter()
        if (ad == null) { onLine("STATE:nobt"); return }
        while (running) {
            try {
                if (!ad.isEnabled) { ad.enable(); Thread.sleep(3000); continue }
                val dev = ad.bondedDevices.firstOrNull { (it.name ?: "").startsWith("BeerTap") }
                if (dev == null) { onLine("STATE:unpaired"); Thread.sleep(5000); continue }
                onLine("STATE:connecting")
                ad.cancelDiscovery()
                val s = dev.createRfcommSocketToServiceRecord(spp)
                s.connect()
                sock = s; out = s.outputStream; connected = true
                onLine("STATE:connected:" + dev.name)
                val r = BufferedReader(InputStreamReader(s.inputStream))
                while (running) {
                    val l = r.readLine() ?: break
                    onLine(l.trim())
                }
            } catch (e: Exception) { }
            connected = false
            try { sock?.close() } catch (e: Exception) {}
            out = null
            onLine("STATE:disconnected")
            try { Thread.sleep(3000) } catch (e: Exception) {}
        }
    }

    fun send(cmd: String): Boolean = try {
        val o = out
        if (o == null || !connected) false else { o.write((cmd + "\n").toByteArray()); o.flush(); true }
    } catch (e: Exception) { false }
}
