export const TEST_FILES = [
  "**/*.{test,spec}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "**/__tests__/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
];
export const FIXTURE_FILES = [
  "**/{tests,__fixtures__,fixtures,fakes,stubs,factories}/**/*.{ts,tsx,mts,cts,js,mjs}",
  "**/*.{fixture,fixtures,fake,stub,factory}.{ts,tsx,mts,cts,js,mjs}",
];

// Fixtures and tests both have to be deterministic.
export const DETERMINISM_SYNTAX = [
  {
    selector:
      "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "Math.random() makes a test nondeterministic. Use a fixed value.",
  },
  {
    selector:
      "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
    message:
      "A random id breaks equality assertions. Use a fixed id such as 'user-1'.",
  },
  {
    selector:
      "NewExpression[callee.name='Date'][arguments.length=0], CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      "Wall-clock time makes a test nondeterministic. Use a fixed date, with vi.setSystemTime() when the code reads the clock.",
  },
];

const VI_CALL =
  "CallExpression[callee.type='MemberExpression'][callee.object.name='vi']";
// Matches test(...), test.skip(...), test.each(...)(...), test.skip.each(...)(...) and test.for(...)(...).
const blockOf = (names) =>
  `:matches(${[
    "callee.name",
    "callee.object.name",
    "callee.callee.object.name",
    "callee.callee.object.object.name",
  ]
    .map((field) => `CallExpression[${field}=/^(${names})$/]`)
    .join(", ")})`;
const TEST_BLOCK = blockOf("it|test");
const ANY_BLOCK = `:matches(${blockOf("it|test|describe")}, CallExpression[callee.name=/^(beforeEach|beforeAll|afterEach|afterAll)$/])`;

// Ways a test passes without testing anything. Each message says what to do instead.
export const TEST_SYNTAX = [
  {
    selector:
      "ExpressionStatement > CallExpression > MemberExpression.callee MemberExpression[property.name=/^(resolves|rejects)$/]",
    message:
      "Unawaited .resolves/.rejects: the test ends before it runs, so it can never fail. Prefix with await.",
  },
  {
    selector:
      "ExpressionStatement > CallExpression > MemberExpression.callee CallExpression[callee.object.name='expect'][callee.property.name=/^(poll|element)$/]",
    message:
      "Unawaited expect.poll()/expect.element() never asserts. Prefix with await.",
  },
  {
    selector: `ExpressionStatement > ${VI_CALL}[callee.property.name=/^(waitFor|waitUntil)$/]`,
    message:
      "Unawaited vi.waitFor()/vi.waitUntil() never checks its condition. Prefix with await.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(then|catch|finally)$/] CallExpression[callee.name='expect']",
    message:
      "expect() inside .then/.catch is skipped unless the chain is awaited. Write const value = await promise; expect(value)..., or await expect(promise).rejects...",
  },
  {
    selector:
      "CallExpression[callee.name='expect'][arguments.0.type='Literal']",
    message:
      "expect(<literal>) can never fail. Assert on a value the code under test produced.",
  },
  {
    selector:
      "MemberExpression[object.name=/^(it|test)$/][property.name='fails']",
    message:
      "test.fails inverts the result, so a broken test passes. Fix the code or the test.",
  },
  {
    selector: `${VI_CALL}[callee.property.name=/^(mock|doMock)$/][arguments.length=1]`,
    message:
      "vi.mock(path) without a factory replaces every export with a stub. Mock only what crosses the boundary: vi.mock(path, async (importOriginal) => ({ ...(await importOriginal()), onlyThis: vi.fn() })).",
  },
  {
    selector: `${VI_CALL}[callee.property.name=/^(mock|doMock)$/] > :function[body.type='ObjectExpression'][body.properties.length=0]`,
    message:
      "vi.mock(path, () => ({})) stubs a module out only so the file under test can be imported. Test one level up, where the real module can load, or leave the test out and say why.",
  },
  {
    selector: `${ANY_BLOCK} ${VI_CALL}[callee.property.name='mock']`,
    message:
      "vi.mock() is hoisted to the top of the file and applies to every test. Put it at the top level, or use vi.doMock() with a dynamic import for one test.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^mockImplementation(Once)?$/] > :function[body.type='BlockStatement'][body.body.length=0]",
    message:
      "An empty mockImplementation swallows behavior. Let the real code run, return a meaningful value, or assert on the call.",
  },
  {
    selector: `CallExpression[callee.property.name=/^mockReturnValue(Once)?$/] > ${VI_CALL}[callee.property.name='fn']`,
    message:
      "A mock that returns a mock encodes the implementation's structure. Test through a real collaborator or a small hand-written fake.",
  },
  {
    selector:
      "CallExpression[callee.name=/^(setTimeout|setInterval|setImmediate|sleep|delay|wait|pause)$/]",
    message:
      "A real wait makes a test slow and flaky. Await the promise itself, use vi.useFakeTimers() and advance, or await vi.waitFor(() => ...).",
  },
  {
    selector: `${TEST_BLOCK} ${VI_CALL}[callee.property.name='useFakeTimers']`,
    message:
      "vi.useFakeTimers() inside a test leaks when the test throws. Move it to beforeEach, with vi.useRealTimers() in afterEach.",
  },
  {
    selector: `${VI_CALL}[callee.property.name='spyOn'][arguments.0.name='Date']`,
    message:
      "Do not spy on Date. Use vi.useFakeTimers() with vi.setSystemTime().",
  },
];
