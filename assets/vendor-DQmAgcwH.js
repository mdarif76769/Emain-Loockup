import { r as reactBundle } from "./react-bundle.js"; // আপনার প্রোজেক্টের রিয়েক্ট সোর্স বা বান্ডেল পাথ

// ==========================================
// ১. Scheduler / Core Async Utilities
// ==========================================
var schedulerExports = {};
var schedulerInitialized = 0;

function initScheduler() {
  if (schedulerInitialized) return schedulerExports;
  schedulerInitialized = 1;

  (function (exports) {
    function push(heap, node) {
      var index = heap.length;
      heap.push(node);
      e: for (; 0 < index; ) {
        var parentIndex = (index - 1) >>> 1, parent = heap[parentIndex];
        if (0 < compare(parent, node)) {
          heap[parentIndex] = node;
          heap[index] = parent;
          index = parentIndex;
        } else break e;
      }
    }

    function peek(heap) { return heap.length === 0 ? null : heap[0]; }

    function pop(heap) {
      if (heap.length === 0) return null;
      var first = heap[0], last = heap.pop();
      if (last !== first) {
        heap[0] = last;
        e: for (var index = 0, length = heap.length, halfLength = length >>> 1; index < halfLength; ) {
          var leftIndex = 2 * (index + 1) - 1, left = heap[leftIndex], rightIndex = leftIndex + 1, right = heap[rightIndex];
          if (0 > compare(left, last)) {
            if (rightIndex < length && 0 > compare(right, left)) {
              heap[index] = right; heap[rightIndex] = last; index = rightIndex;
            } else {
              heap[index] = left; heap[leftIndex] = last; index = leftIndex;
            }
          } else if (rightIndex < length && 0 > compare(right, last)) {
            heap[index] = right; heap[rightIndex] = last; index = rightIndex;
          } else break e;
        }
      }
      return first;
    }

    function compare(a, b) {
      var diff = a.sortIndex - b.sortIndex;
      return diff !== 0 ? diff : a.id - b.id;
    }

    if (typeof performance === "object" && typeof performance.now === "function") {
      var perf = performance;
      exports.unstable_now = function () { return perf.now(); };
    } else {
      var localDate = Date, initialTime = localDate.now();
      exports.unstable_now = function () { return localDate.now() - initialTime; };
    }

    var taskQueue = [], timerQueue = [], userIdCounter = 1, currentTask = null, currentPriorityLevel = 3, isHostCallbackScheduled = !1, isHostTimeoutScheduled = !1, isPerformingWork = !1, isMessageLoopRunning = !1;
    var localSetTimeout = typeof setTimeout === "function" ? setTimeout : null, localClearTimeout = typeof clearTimeout === "function" ? clearTimeout : null, localSetImmediate = typeof setImmediate < "u" ? setImmediate : null;

    function advanceTimers(currentTime) {
      for (var timer = peek(timerQueue); timer !== null; ) {
        if (timer.callback === null) pop(timerQueue);
        else if (timer.startTime <= currentTime) {
          pop(timerQueue); timer.sortIndex = timer.expirationTime; push(taskQueue, timer);
        } else break;
        timer = peek(timerQueue);
      }
    }

    function handleTimeout(currentTime) {
      isHostTimeoutScheduled = !1; advanceTimers(currentTime);
      if (!isHostCallbackScheduled) {
        if (peek(taskQueue) !== null) { isHostCallbackScheduled = !0; schedulePerformWorkUntilDeadline(); }
        else { var nextTimer = peek(timerQueue); nextTimer !== null && requestHostTimeout(handleTimeout, nextTimer.startTime - currentTime); }
      }
    }

    var isMessageLoopRunning = !1, taskTimeoutID = -1, frameInterval = 5, lastRemainingTime = -1;
    function shouldYieldToHost() { return isMessageLoopRunning ? !0 : !(exports.unstable_now() - lastRemainingTime < frameInterval); }

    function performWorkUntilDeadline() {
      isMessageLoopRunning = !1;
      if (isHostCallbackScheduled) {
        var currentTime = exports.unstable_now(); lastRemainingTime = currentTime; var hasMoreWork = !0;
        try {
          e: {
            isHostCallbackScheduled = !1; isHostTimeoutScheduled && (isHostTimeoutScheduled = !1, localClearTimeout(taskTimeoutID), taskTimeoutID = -1); isPerformingWork = !0;
            var previousPriorityLevel = currentPriorityLevel;
            try {
              o: {
                advanceTimers(currentTime);
                for (currentTask = peek(taskQueue); currentTask !== null && !(currentTask.expirationTime > currentTime && shouldYieldToHost()); ) {
                  var callback = currentTask.callback;
                  if (typeof callback === "function") {
                    currentTask.callback = null; currentPriorityLevel = currentTask.priorityLevel;
                    var didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
                    var continuationCallback = callback(didUserCallbackTimeout);
                    currentTime = exports.unstable_now();
                    if (typeof continuationCallback === "function") { currentTask.callback = continuationCallback; advanceTimers(currentTime); hasMoreWork = !0; break o; }
                    currentTask === peek(taskQueue) && pop(taskQueue); advanceTimers(currentTime);
                  } else pop(taskQueue);
                  currentTask = peek(taskQueue);
                }
                if (currentTask !== null) hasMoreWork = !0;
                else { var nextTimer = peek(timerQueue); nextTimer !== null && requestHostTimeout(handleTimeout, nextTimer.startTime - currentTime); hasMoreWork = !1; }
              }
              break e;
            } finally { currentTask = null; currentPriorityLevel = previousPriorityLevel; isPerformingWork = !1; }
          }
        } finally { hasMoreWork ? schedulePerformWorkUntilDeadline() : isHostCallbackScheduled = !1; }
      }
    }

    var schedulePerformWorkUntilDeadline;
    if (typeof localSetImmediate === "function") schedulePerformWorkUntilDeadline = function () { localSetImmediate(performWorkUntilDeadline); };
    else if (typeof MessageChannel < "u") {
      var channel = new MessageChannel, port = channel.port2; channel.port1.onmessage = performWorkUntilDeadline;
      schedulePerformWorkUntilDeadline = function () { port.postMessage(null); };
    } else schedulePerformWorkUntilDeadline = function () { localSetTimeout(performWorkUntilDeadline, 0); };

    function requestHostTimeout(callback, ms) { taskTimeoutID = localSetTimeout(function () { callback(exports.unstable_now()); }, ms); }

    exports.unstable_IdlePriority = 5; exports.unstable_ImmediatePriority = 1; exports.unstable_LowPriority = 4; exports.unstable_NormalPriority = 3; exports.unstable_Profiling = null; exports.unstable_UserBlockingPriority = 2;
    exports.unstable_cancelCallback = function (task) { task.callback = null; };
    exports.unstable_forceFrameRate = function (fps) { 0 > fps || 125 < fps ? console.error("forceFrameRate takes a positive int between 0 and 125") : frameInterval = 0 < fps ? Math.floor(1e3 / fps) : 5; };
    exports.unstable_getCurrentPriorityLevel = function () { return currentPriorityLevel; };
    exports.unstable_shouldYield = shouldYieldToHost;
  })(schedulerExports);

  return schedulerExports;
}

const getScheduler = () => { return schedulerInitialized ? schedulerExports : initScheduler(); };

// ==========================================
// ২. CLSX / Class Name Concatenation
// ==========================================
function toClassName(mix) {
  var k, v, str = "";
  if (typeof mix === "string" || typeof mix === "number") str += mix;
  else if (typeof mix === "object") {
    if (Array.isArray(mix)) {
      var len = mix.length;
      for (k = 0; k < len; k++) mix[k] && (v = toClassName(mix[k])) && (str && (str += " "), str += v);
    } else for (v in mix) mix[v] && (str && (str += " "), str += v);
  }
  return str;
}

function clsx() {
  for (var i = 0, tmp, x, str = "", len = arguments.length; i < len; i++) 
    (tmp = arguments[i]) && (x = toClassName(tmp)) && (str && (str += " "), str += x);
  return str;
}

// ==========================================
// ৩. Tailwind Merge Core Engine (v4 Compatible)
// ==========================================
const mergeArrays = (a, b) => {
  const res = new Array(a.length + b.length);
  for (let i = 0; i < a.length; i++) res[i] = a[i];
  for (let i = 0; i < b.length; i++) res[a.length + i] = b[i];
  return res;
};

const createConfigUtils = (config) => {
  const tree = createPartLookupTree(config);
  const { conflictingClassGroups, conflictingClassGroupModifiers } = config;
  return {
    getClassGroupId: (className) => {
      if (className.startsWith("[") && className.endsWith("]")) return getArbitraryClassGroupId(className);
      const parts = className.split("-");
      const startIdx = parts[0] === "" && parts.length > 1 ? 1 : 0;
      return findClassGroupId(parts, startIdx, tree);
    },
    getConflictingClassGroupIds: (groupId, hasModifier) => {
      if (hasModifier) {
        const modConflicts = conflictingClassGroupModifiers[groupId];
        const groupConflicts = conflictingClassGroups[groupId];
        return modConflicts ? (groupConflicts ? mergeArrays(groupConflicts, modConflicts) : modConflicts) : groupConflicts || [];
      }
      return conflictingClassGroups[groupId] || [];
    }
  };
};

const findClassGroupId = (parts, index, node) => {
  if (parts.length - index === 0) return node.classGroupId;
  const part = parts[index];
  const nextNode = node.nextPart.get(part);
  if (nextNode) {
    const groupId = findClassGroupId(parts, index + 1, nextNode);
    if (groupId) return groupId;
  }
  const validators = node.validators;
  if (validators === null) return;
  const subName = index === 0 ? parts.join("-") : parts.slice(index).join("-");
  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];
    if (validator.validator(subName)) return validator.classGroupId;
  }
};

const getArbitraryClassGroupId = (className) => {
  const inner = className.slice(1, -1);
  const colonIdx = inner.indexOf(":");
  if (colonIdx === -1) return;
  const prefix = inner.slice(0, colonIdx);
  return prefix ? "arbitrary.." + prefix : void 0;
};

const createPartLookupTree = (config) => {
  const { theme, classGroups } = config;
  const root = { nextPart: new Map(), validators: null };
  for (const groupId in classGroups) {
    const definitions = classGroups[groupId];
    processDefinitions(definitions, root, groupId, theme);
  }
  return root;
};

const processDefinitions = (definitions, node, groupId, theme) => {
  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    addDefinition(def, node, groupId, theme);
  }
};

const addDefinition = (def, node, groupId, theme) => {
  if (typeof def === "string") {
    const targetNode = def === "" ? node : appendParts(node, def);
    targetNode.classGroupId = groupId;
    return;
  }
  if (typeof def === "function") {
    node.validators === null && (node.validators = []);
    node.validators.push({ classGroupId: groupId, validator: def });
    return;
  }
  const entries = Object.entries(def);
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    processDefinitions(value, appendParts(node, key), groupId, theme);
  }
};

const appendParts = (node, path) => {
  let current = node;
  const parts = path.split("-");
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    let next = current.nextPart.get(part);
    if (!next) {
      next = { nextPart: new Map(), validators: null };
      current.nextPart.set(part, next);
    }
    current = next;
  }
  return current;
};

const createCache = (size) => {
  if (size < 1) return { get: () => {}, set: () => {} };
  let count = 0, cacheA = Object.create(null), cacheB = Object.create(null);
  const update = (k, v) => {
    cacheA[k] = v; count++;
    if (count > size) { count = 0; cacheB = cacheA; cacheA = Object.create(null); }
  };
  return {
    get(k) {
      let val = cacheA[k]; if (val !== void 0) return val;
      if ((val = cacheB[k]) !== void 0) return update(k, val), val;
    },
    set(k, v) { k in cacheA ? cacheA[k] = v : update(k, v); }
  };
};

const parseClassNameGenerator = (config) => {
  const { prefix, experimentalParseClassName } = config;
  let parser = (className) => {
    const modifiers = [];
    let bracketDepth = 0, parenDepth = 0, colonIdx = 0, postfixIdx;
    for (let i = 0; i < className.length; i++) {
      const char = className[i];
      if (bracketDepth === 0 && parenDepth === 0) {
        if (char === ":") { modifiers.push(className.slice(colonIdx, i)); colonIdx = i + 1; continue; }
        if (char === "/") { postfixIdx = i; continue; }
      }
      char === "[" ? bracketDepth++ : char === "]" ? bracketDepth-- : char === "(" ? parenDepth++ : char === ")" && parenDepth--;
    }
    const base = modifiers.length === 0 ? className : className.slice(colonIdx);
    let cleanBase = base, hasImportant = !1;
    if (base.endsWith("!")) { cleanBase = base.slice(0, -1); hasImportant = !0; }
    else if (base.startsWith("!")) { cleanBase = base.slice(1); hasImportant = !0; }
    const posPos = postfixIdx && postfixIdx > colonIdx ? postfixIdx - colonIdx : void 0;
    return { modifiers, hasImportantModifier: hasImportant, baseClassName: cleanBase, maybePostfixModifierPosition: posPos, isExternal: !1 };
  };
  return parser;
};

const createModifierSorter = (config) => {
  const modOrder = new Map();
  config.orderSensitiveModifiers.forEach((mod, idx) => modOrder.set(mod, 1e6 + idx));
  return (modifiers) => {
    const res = []; let arbitrary = [];
    for (let i = 0; i < modifiers.length; i++) {
      const mod = modifiers[i];
      if (mod.startsWith("[") || modOrder.has(mod)) {
        if (arbitrary.length > 0) { arbitrary.sort(); res.push(...arbitrary); arbitrary = []; }
        res.push(mod);
      } else arbitrary.push(mod);
    }
    if (arbitrary.length > 0) { arbitrary.sort(); res.push(...arbitrary); }
    return res;
  };
};

const twMergeConfigBuilder = (config) => ({
  cache: createCache(config.cacheSize),
  parseClassName: parseClassNameGenerator(config),
  sortModifiers: createModifierSorter(config),
  postfixLookupClassGroupIds: ((c) => {
    const lookup = Object.create(null); const groups = c.postfixLookupClassGroups;
    if (groups) for (let i = 0; i < groups.length; i++) lookup[groups[i]] = !0;
    return lookup;
  })(config),
  ...createConfigUtils(config)
});

const tailwindMergeCore = (classes, utils) => {
  const { parseClassName, getClassGroupId, getConflictingClassGroupIds, sortModifiers, postfixLookupClassGroupIds } = utils;
  const list = []; const splitClasses = classes.trim().split(/\s+/);
  let finalStr = "";
  for (let i = splitClasses.length - 1; i >= 0; i -= 1) {
    const rawClass = splitClasses[i];
    const { isExternal, modifiers, hasImportantModifier, baseClassName, maybePostfixModifierPosition } = parseClassName(rawClass);
    if (isExternal) { finalStr = rawClass + (finalStr.length > 0 ? " " + finalStr : finalStr); continue; }
    let isPostfix = !!maybePostfixModifierPosition, groupId;
    if (isPostfix) {
      const sub = baseClassName.substring(0, maybePostfixModifierPosition);
      groupId = getClassGroupId(sub);
      const lookupId = groupId && postfixLookupClassGroupIds[groupId] ? getClassGroupId(baseClassName) : void 0;
      if (lookupId && lookupId !== groupId) { groupId = lookupId; isPostfix = !1; }
    } else groupId = getClassGroupId(baseClassName);
    if (!groupId) { finalStr = rawClass + (finalStr.length > 0 ? " " + finalStr : finalStr); continue; }
    const modStr = modifiers.length === 0 ? "" : modifiers.length === 1 ? modifiers[0] : sortModifiers(modifiers).join(":");
    const fullModKey = hasImportantModifier ? modStr + "!" : modStr;
    const finalKey = fullModKey + groupId;
    if (list.indexOf(finalKey) > -1) continue;
    list.push(finalKey);
    const conflicts = getConflictingClassGroupIds(groupId, isPostfix);
    for (let j = 0; j < conflicts.length; ++j) list.push(fullModKey + conflicts[j]);
    finalStr = rawClass + (finalStr.length > 0 ? " " + finalStr : finalStr);
  }
  return finalStr;
};

const createTailwindMerge = (configFn, ...extFns) => {
  let utils, cacheGet, cacheSet, mergeFn;
  const init = (str) => {
    const builtConfig = extFns.reduce((acc, fn) => fn(acc), configFn());
    utils = twMergeConfigBuilder(builtConfig);
    cacheGet = utils.cache.get; cacheSet = utils.cache.set;
    mergeFn = run;
    return run(str);
  };
  const run = (str) => {
    const cached = cacheGet(str); if (cached) return cached;
    const computed = tailwindMergeCore(str, utils);
    return cacheSet(str, computed), computed;
  };
  mergeFn = init;
  return (...args) => mergeFn(clsx(...args));
};

// Regex & Target Rules Configuration
const arbitraryRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
const parenRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
const isFraction = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
const isBreakpoint = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
const isDimensions = /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
const isShadowPattern = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;

const twConfig = () => {
  const cGroup = (g) => () => [];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"], aspect: ["video"],
      font: [() => !0], "font-weight": ["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"],
      spacing: ["px", (e) => !isNaN(Number(e))]
    },
    classGroups: {
      aspect: [{ aspect: ["auto", "square", isFraction, (e) => arbitraryRegex.test(e)] }],
      container: ["container"], display: ["block", "inline-block", "inline", "flex", "grid", "hidden"],
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      p: [{ p: [(e) => !isNaN(Number(e))] }], px: [{ px: [(e) => !isNaN(Number(e))] }], py: [{ py: [(e) => !isNaN(Number(e))] }],
      m: [{ m: [(e) => !isNaN(Number(e))] }], mx: [{ mx: [(e) => !isNaN(Number(e))] }], my: [{ my: [(e) => !isNaN(Number(e))] }],
      w: [{ w: ["screen", "full", "auto", (e) => !isNaN(Number(e))] }], h: [{ h: ["screen", "full", "auto", (e) => !isNaN(Number(e))] }],
      "font-size": [{ text: ["base", (e) => isBreakpoint.test(e)] }],
      "text-color": [{ text: [() => !0] }], "bg-color": [{ bg: [() => !0] }],
      rounded: [{ rounded: ["", "none", "full"] }], border: [{ border: ["", "none"] }]
    },
    conflictingClassGroups: {
      overflow: ["overflow-x", "overflow-y"], p: ["px", "py", "pt", "pr", "pb", "pl"], px: ["pr", "pl"], py: ["pt", "pb"],
      m: ["mx", "my", "mt", "mr", "mb", "ml"], mx: ["mr", "ml"], my: ["mt", "mb"], size: ["w", "h"]
    },
    conflictingClassGroupModifiers: { "font-size": ["leading"] },
    postfixLookupClassGroups: ["container-type"],
    orderSensitiveModifiers: ["after", "before", "hover", "focus", "active"]
  };
};

const tailwindMerge = createTailwindMerge(twConfig);

// ==========================================
// ৪. CVA (Class Variance Authority)
// ==========================================
const cleanVariantValue = (val) => typeof val === "boolean" ? `${val}` : val === 0 ? "0" : val;

const cva = (baseStyles, options) => {
  return (props) => {
    if (options?.variants == null) return clsx(baseStyles, props?.class, props?.className);
    const { variants, defaultVariants } = options;
    const dynamicClasses = Object.keys(variants).map((key) => {
      const propVal = props?.[key]; const defaultVal = defaultVariants?.[key];
      if (propVal === null) return null;
      const finalVal = cleanVariantValue(propVal) || cleanVariantValue(defaultVal);
      return variants[key][finalVal];
    });
    const parsedProps = props && Object.entries(props).reduce((acc, [k, v]) => (v !== void 0 && (acc[k] = v), acc), {});
    const compoundClasses = options?.compoundVariants?.reduce((acc, currentCompound) => {
      let { class: c, className: cn, ...selectors } = currentCompound;
      return Object.entries(selectors).every(([sKey, sVal]) => 
        Array.isArray(sVal) ? sVal.includes({ ...defaultVariants, ...parsedProps }[sKey]) : { ...defaultVariants, ...parsedProps }[sKey] === sVal
      ) ? [...acc, c, cn] : acc;
    }, []) || [];
    return clsx(baseStyles, dynamicClasses, compoundClasses, props?.class, props?.className);
  };
};

// ==========================================
// ৫. Public Exports
// ==========================================
export { 
  cva as a, 
  clsx as c, 
  getScheduler as r, 
  tailwindMerge as t 
};
