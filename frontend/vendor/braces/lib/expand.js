'use strict';

const fill = require('fill-range');
const stringify = require('./stringify');
const utils = require('./utils');

const append = (queue = '', stash = '', enclose = false, depth = 0) => {
  if (depth > 128) throw new RangeError('braces: maximum expansion nesting exceeded');
  const result = [];

  queue = [].concat(queue);
  stash = [].concat(stash);

  if (!stash.length) return queue;
  // Check the Cartesian product BEFORE building the intermediate array.
  if (queue.length * stash.length > utils.MAX_EXPANSION_RESULTS) {
    throw new RangeError('braces: maximum expansion results exceeded');
  }
  if (!queue.length) {
    return enclose ? utils.flatten(stash).map(ele => `{${ele}}`) : stash;
  }

  for (const item of queue) {
    if (Array.isArray(item)) {
      for (const value of item) {
        if (result.length >= utils.MAX_EXPANSION_RESULTS) {
          throw new RangeError('braces: maximum expansion results exceeded');
        }
        result.push(append(value, stash, enclose, depth + 1));
      }
    } else {
      for (let ele of stash) {
        if (enclose === true && typeof ele === 'string') ele = `{${ele}}`;
        if (result.length >= utils.MAX_EXPANSION_RESULTS) {
          throw new RangeError('braces: maximum expansion results exceeded');
        }
        result.push(Array.isArray(ele) ? append(item, ele, enclose, depth + 1) : item + ele);
      }
    }
  }
  return utils.flatten(result);
};

const expand = (ast, options = {}) => {
  const rangeLimit = options.rangeLimit === undefined ? 1000 : options.rangeLimit;

  const walk = (node, parent = {}, depth = 0) => {
    if (depth > 128) throw new RangeError('braces: maximum AST nesting exceeded');
    node.queue = [];

    let p = parent;
    let q = parent.queue;

    while (p.type !== 'brace' && p.type !== 'root' && p.parent) {
      p = p.parent;
      q = p.queue;
    }

    if (node.invalid || node.dollar) {
      q.push(append(q.pop(), stringify(node, options)));
      return;
    }

    if (node.type === 'brace' && node.invalid !== true && node.nodes.length === 2) {
      q.push(append(q.pop(), ['{}']));
      return;
    }

    if (node.nodes && node.ranges > 0) {
      const args = utils.reduce(node.nodes);

      if (utils.exceedsLimit(...args, options.step, rangeLimit)) {
        throw new RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
      }

      // rangeLimit:false must not disable the fixed safety budget.
      if (utils.exceedsLimit(...args, options.step, utils.MAX_EXPANSION_RESULTS)) {
        throw new RangeError('braces: maximum expansion results exceeded');
      }
      let range = fill(...args, options);
      if (Array.isArray(range) && range.length > utils.MAX_EXPANSION_RESULTS) {
        throw new RangeError('braces: maximum expansion results exceeded');
      }
      if (range.length === 0) {
        range = stringify(node, options);
      }

      q.push(append(q.pop(), range));
      node.nodes = [];
      return;
    }

    const enclose = utils.encloseBrace(node);
    let queue = node.queue;
    let block = node;

    while (block.type !== 'brace' && block.type !== 'root' && block.parent) {
      block = block.parent;
      queue = block.queue;
    }

    for (let i = 0; i < node.nodes.length; i++) {
      const child = node.nodes[i];

      if (child.type === 'comma' && node.type === 'brace') {
        if (i === 1) queue.push('');
        queue.push('');
        continue;
      }

      if (child.type === 'close') {
        q.push(append(q.pop(), queue, enclose));
        continue;
      }

      if (child.value && child.type !== 'open') {
        queue.push(append(queue.pop(), child.value));
        continue;
      }

      if (child.nodes) {
        walk(child, node, depth + 1);
      }
    }

    return queue;
  };

  return utils.flatten(walk(ast));
};

module.exports = expand;
