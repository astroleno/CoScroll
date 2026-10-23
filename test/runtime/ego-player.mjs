/** A real mouse press must survive playback progress updates before release. */
export async function verifyPlayerMouseToggle(page) {
  if (!await page.evaluate(() => document.querySelector('audio').paused)) {
    await page.press('button[aria-label="Pause"]', 'Space');
    await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});
  }
  const results = [];
  for (let iteration = 0; iteration < 2; iteration++) {
    await page.click('button[aria-label="Play"]');
    await page.waitForFunction(() => !document.querySelector('audio').paused, undefined, {timeout: 10000});
    const point = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label="Pause"]');
      const rect = button.getBoundingClientRect(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const q = window.__playerMouseRegression = {button, icon: button.firstElementChild,
        target: document.elementFromPoint(x, y), time: document.querySelector('audio').currentTime, clicks: []};
      q.onClick = event => q.clicks.push({trusted: event.isTrusted, button: event.target.closest('button') === q.button});
      window.addEventListener('click', q.onClick, true);
      return {x, y};
    });
    let held = false;
    try {
      await page.cdp('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1});
      held = true;
      await page.waitForFunction(() => document.querySelector('audio').currentTime > window.__playerMouseRegression.time + .5,
        undefined, {timeout: 10000});
      const duringPress = await page.evaluate(() => {
        const q = window.__playerMouseRegression;
        return {sameButton: q.button === document.querySelector('button[aria-label="Pause"]'),
          sameIcon: q.icon === q.button.firstElementChild, pressedNodeConnected: q.target.isConnected,
          mediaAdvanced: document.querySelector('audio').currentTime - q.time};
      });
      await page.cdp('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1});
      held = false;
      await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});
      const result = {...duringPress, ...await page.evaluate(() => ({paused: document.querySelector('audio').paused,
        clicks: window.__playerMouseRegression.clicks}))};
      results.push(result);
      if (!result.sameButton || !result.sameIcon || !result.pressedNodeConnected || !result.paused ||
          result.clicks.length !== 1 || !result.clicks[0].trusted || !result.clicks[0].button) {
        throw Error('Playback updates interrupted a mouse click: ' + JSON.stringify(result));
      }
    } finally {
      if (held) await page.cdp('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1});
      await page.evaluate(() => {
        window.removeEventListener('click', window.__playerMouseRegression.onClick, true);
        delete window.__playerMouseRegression;
      });
    }
  }
  return results;
}
