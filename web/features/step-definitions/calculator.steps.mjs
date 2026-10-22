import { After, Before, Given, Then, When, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

setDefaultTimeout(15_000);

let browser;
let page;

Before(async function () {
  browser = await chromium.launch({ headless: true });
});

After(async function () {
  await browser?.close();
});

Given('I open the calculator at {int} by {int}', async function (width, height) {
  page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:5173');
  await page.getByRole('heading', { name: 'Calculator' }).waitFor();
});

When('I enter and calculate {string}', async function (expression) {
  await enterAndCalculate(expression);
});

Then('I see the result {string}', async function (result) {
  await page.getByRole('status').getByText(result, { exact: true }).waitFor();
  assert.equal(await page.getByRole('status').textContent(), result);
});

Then('the complete application shell fits the viewport', async function () {
  const measurements = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    main: document.querySelector('main')?.getBoundingClientRect().toJSON(),
    calculator: document.querySelector('.calculator-card')?.getBoundingClientRect().toJSON(),
    menu: document.querySelector('aside')?.getBoundingClientRect().toJSON(),
  }));
  assert.ok(measurements.documentWidth <= measurements.viewportWidth, `horizontal overflow: ${JSON.stringify(measurements)}`);
  assert.ok(measurements.main && measurements.main.left >= 0 && measurements.main.right <= measurements.viewportWidth, JSON.stringify(measurements));
  assert.ok(measurements.calculator && measurements.calculator.left >= measurements.main.left && measurements.calculator.right <= measurements.main.right, JSON.stringify(measurements));
  assert.ok(measurements.menu && measurements.menu.right <= measurements.main.left, JSON.stringify(measurements));
});

Then('the Sezzle brand palette is applied', async function () {
  const palette = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      purple: style.getPropertyValue('--brand-purple').trim(),
      mint: style.getPropertyValue('--brand-mint').trim(),
    };
  });
  assert.equal(palette.purple.toLowerCase(), '#382757');
  assert.equal(palette.mint.toLowerCase(), '#9ff4d9');
});

Then('the attribution appears below the ready status in matching style', async function () {
  const details = await page.evaluate(() => {
    const stack = document.querySelector('.status-stack');
    const ready = stack?.querySelector('.api-indicator:not(.status-attribution)');
    const attribution = stack?.querySelector('.status-attribution');
    if (!stack || !ready || !attribution) return null;
    const readyStyle = getComputedStyle(ready);
    const attributionStyle = getComputedStyle(attribution);
    return {
      sameStack: ready.parentElement === attribution.parentElement,
      readyBottom: ready.getBoundingClientRect().bottom,
      attributionTop: attribution.getBoundingClientRect().top,
      readyColor: readyStyle.color,
      attributionColor: attributionStyle.color,
      readySize: readyStyle.fontSize,
      attributionSize: attributionStyle.fontSize,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  assert.ok(details, 'status stack and attribution should exist');
  assert.equal(details.sameStack, true);
  assert.ok(details.attributionTop >= details.readyBottom, JSON.stringify(details));
  assert.equal(details.attributionColor, details.readyColor);
  assert.equal(details.attributionSize, details.readySize);
  assert.ok(details.documentWidth <= details.viewportWidth, JSON.stringify(details));
});

Then('I see a safe calculation error with a support reference', async function () {
  const alert = page.getByRole('alert');
  await alert.waitFor();
  assert.match(await alert.textContent(), /Could not calculate/);
  assert.match(await alert.textContent(), /Support reference:/);
  assert.doesNotMatch(await alert.textContent(), /panic|stack|exception/i);
});

When('I clear the expression and calculate {string}', async function (expression) {
  await page.getByRole('button', { name: 'C', exact: true }).click();
  await enterAndCalculate(expression);
});

When('I enter the advanced expression using the keypad', async function () {
  const keys = ['√', '8', '1', ')', '+', '2', '^', '3', '+', '2', '5', '%', '='];
  for (const key of keys) await page.getByRole('button', { name: key, exact: true }).click();
});

When('I type and calculate expression {string} with the keyboard', async function (expression) {
  await page.keyboard.type(expression);
  await page.keyboard.press('Enter');
});

When('I type and calculate {string} using the exponent keyboard shortcut', async function (expression) {
  const [base, exponent] = expression.split('^');
  await page.keyboard.type(base);
  await page.keyboard.press('Shift+6');
  await page.keyboard.type(exponent);
  await page.keyboard.press('Enter');
});

async function enterAndCalculate(expression) {
  for (const character of expression) {
    const labels = { '*': '×', '/': '÷', '-': '−' };
    await page.getByRole('button', { name: labels[character] ?? character, exact: true }).click();
  }
  await page.getByRole('button', { name: '=', exact: true }).click();
}
