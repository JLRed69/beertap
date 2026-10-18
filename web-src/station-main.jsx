function fit() {
  var s = Math.min(1, window.innerHeight / 600, window.innerWidth / 340);
  document.getElementById('root').style.zoom = s;
}
var params = new URLSearchParams(location.search);
var room = params.get('room') || (window.BeerTapNative && window.BeerTapNative.room()) || 'demo';
fit();
window.addEventListener('resize', fit);
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StationApp, { room: room }));
