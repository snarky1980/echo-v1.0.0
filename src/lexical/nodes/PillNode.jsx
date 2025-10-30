import { DecoratorNode } from 'lexical';
import React from 'react';
import PillComponent from '../PillComponent';

export class PillNode extends DecoratorNode {
  __name;
  __value;
  __isFilled;

  static getType() {
    return 'pill';
  }

  static clone(node) {
    return new PillNode(node.__name, node.__value, node.__isFilled, node.__key);
  }

  constructor(name, value, isFilled, key) {
    super(key);
    this.__name = name;
    this.__value = value;
    this.__isFilled = isFilled;
  }

  createDOM() {
    return document.createElement('span');
  }

  updateDOM() {
    return false;
  }

  decorate() {
    return (
      <PillComponent
        name={this.__name}
        value={this.__value}
        isFilled={this.__isFilled}
      />
    );
  }
}

export function $createPillNode(name, value, isFilled) {
  return new PillNode(name, value, isFilled);
}

export function $isPillNode(node) {
  return node instanceof PillNode;
}
