main-app.js?v=1759774035987:1575 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
app-index.js:34 Warning: Prop `style` did not match. Server: "opacity:1;color:#E2E8F0;pointer-events:auto;user-select:auto;height:auto;padding-top:3rem;padding-bottom:3rem;line-height:1.6;font-size:2rem;font-family:\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans SC\", sans-serif;transition:opacity 0.3s ease;backface-visibility:hidden;touch-action:pan-y" Client: "opacity:1;color:#E2E8F0;pointer-events:auto;user-select:auto;height:auto;padding-top:3rem;padding-bottom:3rem;line-height:1.6;font-size:1.8rem;font-family:\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans SC\", sans-serif;transition:opacity 0.3s ease;backface-visibility:hidden;touch-action:pan-y"
    at p
    at div
    at div
    at LyricsController (webpack-internal:///(app-pages-browser)/./src/components/LyricsController.tsx:23:11)
    at div
    at main
    at PageVisibilityManager (webpack-internal:///(app-pages-browser)/./src/components/audio/PageVisibilityManager.tsx:15:11)
    at div
    at HomePage (webpack-internal:///(app-pages-browser)/./src/app/page.tsx:211:90)
    at StaticGenerationSearchParamsBailoutProvider (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/static-generation-searchparams-bailout-provider.js:15:11)
    at InnerLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:240:11)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:72:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:80:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:54:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:62:11)
    at LoadingBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:315:11)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:130:11)
    at InnerScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:151:9)
    at ScrollAndFocusHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:226:11)
    at RenderFromTemplateContext (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/render-from-template-context.js:15:44)
    at OuterLayoutRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/layout-router.js:325:11)
    at body
    at html
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:72:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/redirect-boundary.js:80:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:54:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/not-found-boundary.js:62:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/dev-root-not-found-boundary.js:32:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/internal/ReactDevOverlay.js:66:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/react-dev-overlay/hot-reloader-client.js:295:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:159:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:100:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/error-boundary.js:130:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/components/app-router.js:436:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:128:11)
    at RSCComponent
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/next/dist/client/app-index.js:144:11)
window.console.error @ app-index.js:34
console.error @ hydration-error-info.js:41
console.error @ index.js:77
printWarning @ react-dom.development.js:94
error @ react-dom.development.js:68
warnForPropDifference @ react-dom.development.js:32523
diffHydratedStyles @ react-dom.development.js:34053
diffHydratedGenericElement @ react-dom.development.js:34506
diffHydratedProperties @ react-dom.development.js:34916
hydrateInstance @ react-dom.development.js:35925
prepareToHydrateHostInstance @ react-dom.development.js:7287
completeWork @ react-dom.development.js:19675
completeUnitOfWork @ react-dom.development.js:25793
performUnitOfWork @ react-dom.development.js:25598
workLoopConcurrent @ react-dom.development.js:25573
renderRootConcurrent @ react-dom.development.js:25529
performConcurrentWorkOnRoot @ react-dom.development.js:24382
workLoop @ scheduler.development.js:261
flushWork @ scheduler.development.js:230
performWorkUntilDeadline @ scheduler.development.js:534
AutoPlayGuard.tsx:21 [AutoPlayGuard] Force showing guard
page.tsx:254 [HomePage] Mobile detection: {userAgent: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA', isMobileDevice: true, isTouchDevice: true, isSmallScreen: true, mobile: true}
page.tsx:272 [HomePage] Setting audio source: /audio/心经_2.mp3
page.tsx:415 [锚字更新] 心 -> 观
page.tsx:437 [当前锚字] 观 - 观自在菩萨 (起点——觉知开启)
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '心', total: 0, loaded: 0, loading: 0, pending: 0, …}
AutoPlayGuard.tsx:21 [AutoPlayGuard] Force showing guard
page.tsx:254 [HomePage] Mobile detection: {userAgent: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA', isMobileDevice: true, isTouchDevice: true, isSmallScreen: true, mobile: true}
page.tsx:272 [HomePage] Setting audio source: /audio/心经_2.mp3
page.tsx:415 [锚字更新] 心 -> 观
page.tsx:437 [当前锚字] 观 - 观自在菩萨 (起点——觉知开启)
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '心', total: 0, loaded: 0, loading: 0, pending: 0, …}
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '心', total: 0, loaded: 0, loading: 0, pending: 0, …}
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '观', total: 0, loaded: 0, loading: 0, pending: 0, …}
page.tsx:208 [HomePage] 开始页面初始化预加载...
page.tsx:218 [HomePage] 优先级模型: (3) ['/models/10k_obj/101_观.obj', '/models/10k_obj/001_空.obj', '/models/10k_obj/045_苦.obj']
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '心', total: 12, loaded: 1, loading: 1, pending: 11, …}
page.tsx:163 [02:07:23] Audio engine ready
(index):1 Uncaught (in promise) {name: 'i', httpError: false, httpStatus: 200, httpStatusText: '', code: 403, …}
(index):1 Uncaught (in promise) {name: 'i', httpError: false, httpStatus: 200, httpStatusText: '', code: 403, …}
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
LyricBillboard.tsx:74 THREE.Texture: Property .encoding has been replaced by .colorSpace.
warnOnce @ three.module.js:1982
set encoding @ three.module.js:2676
createTextBillboard @ LyricBillboard.tsx:74
eval @ LyricBillboard.tsx:97
mountMemo @ react-reconciler.development.js:8279
useMemo @ react-reconciler.development.js:8739
useMemo @ react.development.js:1772
LyricBillboard @ LyricBillboard.tsx:95
renderWithHooks @ react-reconciler.development.js:7363
mountIndeterminateComponent @ react-reconciler.development.js:12322
beginWork @ react-reconciler.development.js:13826
beginWork$1 @ react-reconciler.development.js:19508
performUnitOfWork @ react-reconciler.development.js:18681
workLoopSync @ react-reconciler.development.js:18592
renderRootSync @ react-reconciler.development.js:18560
performConcurrentWorkOnRoot @ react-reconciler.development.js:17831
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
page.tsx:233 [HomePage] ✅ 页面初始化预加载完成: {total: 12, loaded: 12, loading: 0, pending: 1, error: 0, …}
JadeModelLoader.tsx:392 [JadeModelLoader] 开始加载模型: /models/10k_obj/101_观.obj
JadeModelLoader.tsx:399 [JadeModelLoader] 使用预加载模型: /models/10k_obj/101_观.obj
JadeModelLoader.tsx:503 [JadeModelLoader] 使用缓存 Offset 几何体: {modelPath: '/models/10k_obj/101_观.obj', outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, …}
JadeModelLoader.tsx:561 [JadeModelLoader] 视图适配完成: {size: Array(3), center: Array(3), distance: 2.499779984354973}
JadeModelLoader.tsx:713 [JadeModelLoader] HDR 环境贴图加载成功
three.module.js:26480 THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.
verifyColorSpace @ three.module.js:26480
uploadTexture @ three.module.js:25156
setTexture2D @ three.module.js:24893
setValueT1 @ three.module.js:19188
upload @ three.module.js:19745
setProgram @ three.module.js:30871
WebGLRenderer.renderBufferDirect @ three.module.js:29598
renderObject @ three.module.js:30396
renderObjects @ three.module.js:30365
renderScene @ three.module.js:30226
WebGLRenderer.render @ three.module.js:30044
_textureToCubeUV @ three.module.js:17109
_fromTexture @ three.module.js:16927
fromEquirectangular @ three.module.js:16820
get @ three.module.js:17634
setProgram @ three.module.js:30559
WebGLRenderer.renderBufferDirect @ three.module.js:29598
renderObject @ three.module.js:30396
renderObjects @ three.module.js:30365
renderTransmissionPass @ three.module.js:30301
renderScene @ three.module.js:30222
WebGLRenderer.render @ three.module.js:30044
render$1 @ events-776716bd.esm.js:1594
loop @ events-776716bd.esm.js:1620
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
loop @ events-776716bd.esm.js:1606
requestAnimationFrame
invalidate @ events-776716bd.esm.js:1659
eval @ events-776716bd.esm.js:1523
eval @ index.js:17
setState @ index.js:17
eval @ events-776716bd.esm.js:2112
commitHookEffectListMount @ react-reconciler.development.js:14664
commitLayoutEffectOnFiber @ react-reconciler.development.js:14776
commitLayoutMountEffects_complete @ react-reconciler.development.js:16285
commitLayoutEffects_begin @ react-reconciler.development.js:16262
commitLayoutEffects @ react-reconciler.development.js:16209
commitRootImpl @ react-reconciler.development.js:18940
commitRoot @ react-reconciler.development.js:18806
finishConcurrentRender @ react-reconciler.development.js:18074
performConcurrentWorkOnRoot @ react-reconciler.development.js:17902
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
JadeModelLoader.tsx:744 [JadeModelLoader] 材质环境贴图设置完成
AutoPlayGuard.tsx:27 [AutoPlayGuard] User clicked to start playback
page.tsx:163 [02:07:31] 用户交互触发，移动端: true
favicon.ico:1  GET http://localhost:3002/favicon.ico 404 (Not Found)
page.tsx:415 [锚字更新] 观 -> 空
page.tsx:437 [当前锚字] 空 - 照见五蕴皆空 (体悟本性)
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '观', total: 12, loaded: 12, loading: 0, pending: 1, …}
JadeModelLoader.tsx:392 [JadeModelLoader] 开始加载模型: /models/10k_obj/001_空.obj
JadeModelLoader.tsx:429 [JadeModelLoader] 直接加载模型: /models/10k_obj/001_空.obj
JadeModelLoader.tsx:542 [JadeModelLoader] Offset 几何体缓存未命中，使用回退几何: /models/10k_obj/001_空.obj
eval @ JadeModelLoader.tsx:542
commitHookEffectListMount @ react-reconciler.development.js:14664
commitPassiveMountOnFiber @ react-reconciler.development.js:16526
commitPassiveMountEffects_complete @ react-reconciler.development.js:16490
commitPassiveMountEffects_begin @ react-reconciler.development.js:16477
commitPassiveMountEffects @ react-reconciler.development.js:16465
flushPassiveEffectsImpl @ react-reconciler.development.js:19137
flushPassiveEffects @ react-reconciler.development.js:19090
performConcurrentWorkOnRoot @ react-reconciler.development.js:17802
workLoop @ scheduler.development.js:266
flushWork @ scheduler.development.js:239
performWorkUntilDeadline @ scheduler.development.js:533
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '空', total: 12, loaded: 12, loading: 0, pending: 1, …}
JadeModelLoader.tsx:473 [JadeModelLoader] 模型加载成功: /models/10k_obj/001_空.obj
JadeModelLoader.tsx:503 [JadeModelLoader] 使用缓存 Offset 几何体: {modelPath: '/models/10k_obj/001_空.obj', outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, …}
JadeModelLoader.tsx:561 [JadeModelLoader] 视图适配完成: {size: Array(3), center: Array(3), distance: 2.476924955844879}
JadeModelLoader.tsx:561 [JadeModelLoader] 视图适配完成: {size: Array(3), center: Array(3), distance: 2.476924955844879}
page.tsx:415 [锚字更新] 空 -> 苦
page.tsx:437 [当前锚字] 苦 - 度一切苦厄 (觉悟之因)
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '空', total: 13, loaded: 13, loading: 0, pending: 1, …}
JadeModelLoader.tsx:392 [JadeModelLoader] 开始加载模型: /models/10k_obj/045_苦.obj
JadeModelLoader.tsx:399 [JadeModelLoader] 使用预加载模型: /models/10k_obj/045_苦.obj
JadeModelLoader.tsx:503 [JadeModelLoader] 使用缓存 Offset 几何体: {modelPath: '/models/10k_obj/045_苦.obj', outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, …}
page.tsx:174 [HomePage] 模型预加载状态: {anchor: '苦', total: 13, loaded: 13, loading: 0, pending: 1, …}
JadeModelLoader.tsx:503 [JadeModelLoader] 使用缓存 Offset 几何体: {modelPath: '/models/10k_obj/045_苦.obj', outerOffset: 0.001, maxEdge: 0.15, subdivisions: 0, creaseAngle: 30, …}
JadeModelLoader.tsx:561 [JadeModelLoader] 视图适配完成: {size: Array(3), center: Array(3), distance: 2.4974675476551056}
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
PageVisibilityManager.tsx:40 [PageVisibility] Page hidden - maintaining audio state
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
page.tsx:163 [02:08:23] Page became visible after being hidden
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
PageVisibilityManager.tsx:40 [PageVisibility] Page hidden - maintaining audio state
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
page.tsx:163 [02:09:02] Page became visible after being hidden
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
PageVisibilityManager.tsx:40 [PageVisibility] Page hidden - maintaining audio state
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
page.tsx:163 [02:09:15] Page became visible after being hidden
PageVisibilityManager.tsx:48 [PageVisibility] Page visible - checking audio state
