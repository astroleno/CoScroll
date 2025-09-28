react-dom.development.js:38341 Download the React DevTools for a better development experience: https://reactjs.org/link/react-devtools
app-index.js:34 Warning: Extra attributes from the server: mpa-version,mpa-extension-id
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
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'start' is not exported from 'tone' (imported as 'start').
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Reverb' is not exported from 'tone' (imported as 'Reverb').
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Player' is not exported from 'tone' (imported as 'Player').
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:207 There were more warnings in other files.
You can find a complete log in the terminal.
processMessage @ hot-reloader-client.js:207
Tone.js:3  * Tone.js v14.9.17 * 
Tone.js:3 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://developer.chrome.com/blog/autoplay/#web_audio
oe @ Tone.js:3
Tone.js:3 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://developer.chrome.com/blog/autoplay/#web_audio
start @ Tone.js:3
content.js:5213 Uncaught (in promise) Object
experience:1 Uncaught (in promise) Object
experience:1 Uncaught (in promise) Object
app-index.js:34 Audio initialization error: TypeError: (0 , tone__WEBPACK_IMPORTED_MODULE_2__.start) is not a function
    at eval (useAudio.ts:32:18)
    at HTMLDocument.handleUserInteraction (AudioController.tsx:27:15)
window.console.error @ app-index.js:34
hot-reloader-client.js:162 [Fast Refresh] rebuilding
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'start' is not exported from 'tone' (imported as 'start').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Reverb' is not exported from 'tone' (imported as 'Reverb').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Player' is not exported from 'tone' (imported as 'Player').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
hot-reloader-client.js:207 There were more warnings in other files.
You can find a complete log in the terminal.
processMessage @ hot-reloader-client.js:207
hot-reloader-client.js:162 [Fast Refresh] rebuilding
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'start' is not exported from 'tone' (imported as 'start').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
handler @ hot-reloader-client.js:362
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
handler @ hot-reloader-client.js:362
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Reverb' is not exported from 'tone' (imported as 'Reverb').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
handler @ hot-reloader-client.js:362
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'Player' is not exported from 'tone' (imported as 'Player').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
handler @ hot-reloader-client.js:362
hot-reloader-client.js:210 ./src/hooks/useAudio.ts
Attempted import error: 'context' is not exported from 'tone' (imported as 'context').

Import trace for requested module:
./src/hooks/useAudio.ts
./src/components/core/AudioController.tsx
./src/components/core/ScrollCanvas.tsx
./src/app/experience/page.tsx
processMessage @ hot-reloader-client.js:210
handler @ hot-reloader-client.js:362
hot-reloader-client.js:207 There were more warnings in other files.
You can find a complete log in the terminal.
processMessage @ hot-reloader-client.js:207
handler @ hot-reloader-client.js:362
