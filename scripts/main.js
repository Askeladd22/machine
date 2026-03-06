const MainApp = window.MainApp;
if (!MainApp) throw new Error('MainApp module missing');

MainApp.startMainApp({
  globalRoot: window,
  windowRef: window,
  documentRef: document,
  performanceRef: performance,
  requestAnimationFrameRef: requestAnimationFrame,
  getComputedStyleRef: getComputedStyle
});
