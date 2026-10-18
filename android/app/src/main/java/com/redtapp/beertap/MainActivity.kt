package com.redtapp.beertap

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : Activity() {
    companion object { var maintenance = false }

    private lateinit var web: WebView
    private lateinit var prefs: SharedPreferences
    private lateinit var bt: BtLink
    private val dpm by lazy { getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager }
    private val admin by lazy { ComponentName(this, AdminReceiver::class.java) }
    private var taps = 0
    private var firstTap = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("beertap", MODE_PRIVATE)
        readExtras(intent)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(0xFF0E0A07.toInt())
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { request.grant(request.resources) }
            }
        }
        web.addJavascriptInterface(Bridge(), "BeerTapNative")

        val need = arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isNotEmpty()) requestPermissions(need.toTypedArray(), 1)

        bt = BtLink { line ->
            runOnUiThread { web.evaluateJavascript("window.__btEvent&&window.__btEvent(" + JSONObject.quote(line) + ")", null) }
        }
        loadStation()
        bt.start()
    }

    private fun loadStation() {
        val room = prefs.getString("room", "demo")
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html?mode=station&room=" + room)
    }

    private fun readExtras(i: Intent?) {
        if (i == null) return
        val e = prefs.edit()
        i.getStringExtra("room")?.let { e.putString("room", it) }
        i.getStringExtra("pin")?.let { e.putString("pin", it) }
        e.apply()
        if (i.getBooleanExtra("release", false)) releaseKiosk(true)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val oldRoom = prefs.getString("room", "demo")
        readExtras(intent)
        if (oldRoom != prefs.getString("room", "demo")) loadStation()
    }

    override fun onResume() { super.onResume(); hideSystemUi(); setupKiosk() }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    @Deprecated("Bloqueado en modo dispensador")
    override fun onBackPressed() { }

    override fun onDestroy() { bt.stop(); super.onDestroy() }

    private fun hideSystemUi() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
    }

    private fun setupKiosk() {
        if (maintenance || !dpm.isDeviceOwnerApp(packageName)) return
        dpm.setLockTaskPackages(admin, arrayOf(packageName))
        val f = IntentFilter(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME); addCategory(Intent.CATEGORY_DEFAULT)
        }
        dpm.addPersistentPreferredActivity(admin, f, ComponentName(this, MainActivity::class.java))
        dpm.setKeyguardDisabled(admin, true)
        dpm.setStatusBarDisabled(admin, true)
        dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "7")
        try { startLockTask() } catch (e: Exception) { }
    }

    private fun releaseKiosk(removeOwner: Boolean) {
        maintenance = true
        try { stopLockTask() } catch (e: Exception) { }
        if (dpm.isDeviceOwnerApp(packageName)) {
            dpm.setStatusBarDisabled(admin, false)
            dpm.setKeyguardDisabled(admin, false)
            dpm.clearPackagePersistentPreferredActivities(admin, packageName)
            if (removeOwner) dpm.clearDeviceOwnerApp(packageName)
        }
    }

    // Salida secreta: 7 toques en la esquina superior izquierda en 4 s → PIN
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_DOWN && ev.x < 90 && ev.y < 90) {
            val now = System.currentTimeMillis()
            if (now - firstTap > 4000) { taps = 0; firstTap = now }
            taps++
            if (taps >= 7) { taps = 0; askPin() }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun askPin() {
        val input = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "PIN"
        }
        AlertDialog.Builder(this)
            .setTitle("Mantenimiento BeerTap")
            .setView(input)
            .setPositiveButton("Ir a Ajustes") { _, _ ->
                if (pinOk(input)) { releaseKiosk(false); startActivity(Intent(Settings.ACTION_SETTINGS)) }
            }
            .setNeutralButton("Recargar") { _, _ -> if (pinOk(input)) loadStation() }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun pinOk(i: EditText) = i.text.toString() == prefs.getString("pin", "2580")

    inner class Bridge {
        @JavascriptInterface fun send(cmd: String): Boolean = bt.send(cmd)
        @JavascriptInterface fun isConnected(): Boolean = bt.connected
        @JavascriptInterface fun room(): String = prefs.getString("room", "demo") ?: "demo"
    }
}
