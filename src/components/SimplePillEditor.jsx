import React, { useCallback, useEffect, useRef, useState } from 'react';
import { varKeysMatch } from '../utils/variables';

const escapeHtml = (input = '') =>
  String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const BLOCK_ELEMENTS = new Set([
  'DIV',
  'P',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'NAV',
  'UL',
  'OL',
  'LI',
  'PRE',
  'BLOCKQUOTE',
  'TABLE',
  'TBODY',
  'THEAD',
  'TFOOT',
  'TR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR'
]);

const convertPlainTextToHtml = (text = '') =>
  escapeHtml(text)
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n/g, '<br data-line-break="true">');

const escapeSelector = (value = '') => {
  if (typeof window !== 'undefined' && window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
};

const selectEntirePill = (pill) => {
  if (!pill) return;
  const selection = document.getSelection?.();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(pill);
  selection.removeAllRanges();
  selection.addRange(range);
};

/**
 * SimplePillEditor - A simple contentEditable editor that displays variables as styled pills
 * This is a much simpler alternative to the Lexical framework
 */
const SimplePillEditor = ({ value, onChange, variables, placeholder, onVariablesChange, focusedVarName, onFocusedVarChange, variant = 'default', templateLanguage = 'fr' }) => {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const lastSelectionVarRef = useRef(null);
  const autoSelectTrackerRef = useRef({ varName: null, timestamp: 0 });
  const autoSelectSuppressedUntilRef = useRef(0);
  const clickSelectTimerRef = useRef(null);

  // Resolve variable value by language preference
  const getVarValue = useCallback((name = '') => {
    const lang = (templateLanguage || 'fr').toLowerCase()
    const suffix = name.match(/_(fr|en)$/i)?.[1]?.toLowerCase()
    if (suffix) {
      return variables?.[name] ?? ''
    }
    if (lang === 'en') {
      return variables?.[`${name}_EN`] ?? variables?.[name] ?? ''
    }
    return variables?.[`${name}_FR`] ?? variables?.[name] ?? ''
  }, [variables, templateLanguage])

  // Render the content with pills
  const renderContent = (text) => {
    if (!text) return '';
    
    const regex = /<<([^>]+)>>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const varName = match[1];
      const varValue = getVarValue(varName);
      const isFilled = varValue.trim().length > 0;
      const displayValue = isFilled ? varValue : `<<${varName}>>`;
      const storedValue = `<<${varName}>>`;
      const displayAttr = isFilled ? varValue : '';

      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push(convertPlainTextToHtml(text.substring(lastIndex, match.index)));
      }

      // Add the pill
      const pillClass = `var-pill ${isFilled ? 'filled' : 'empty'}`;
      parts.push(
        `<span class="${pillClass}" data-var="${varName}" data-value="${escapeHtml(storedValue)}" data-display="${escapeHtml(displayAttr)}" contenteditable="true" spellcheck="false">${convertPlainTextToHtml(displayValue)}</span>`
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(convertPlainTextToHtml(text.substring(lastIndex)));
    }

    return parts.join('');
  };

  const applyFocusedPill = useCallback((varName) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.querySelectorAll('.var-pill').forEach((pill) => {
      const pillVar = pill.getAttribute('data-var');
      const isMatch = varName ? varKeysMatch(pillVar, varName) : false;
      pill.classList.toggle('focused', !!isMatch);
    });
  }, []);

  const queueAutoSelectForPill = useCallback((pill, varName) => {
    if (!pill || !varName) return;
    if (!pill.classList.contains('empty')) return;
    const nowTs = Date.now();
    if (nowTs < (autoSelectSuppressedUntilRef.current || 0)) {
      return;
    }
    const selection = document.getSelection?.();
    if (!selection) return;
    if (!selection.isCollapsed && selection.toString()) return;

    const tracker = autoSelectTrackerRef.current;
    const now = Date.now();
    if (tracker.varName === varName && now - tracker.timestamp < 200) {
      return;
    }

    tracker.varName = varName;
    tracker.timestamp = now;

    requestAnimationFrame(() => {
      selectEntirePill(pill);
    });
  }, []);

  const emitFocusedVarChange = useCallback((varName) => {
    const normalized = varName || null;
    if (lastSelectionVarRef.current === normalized) return;
    lastSelectionVarRef.current = normalized;
    if (typeof onFocusedVarChange === 'function') {
      onFocusedVarChange(normalized);
    }
  }, [onFocusedVarChange]);

  // Update the editor when value changes externally
  useEffect(() => {
    if (!editorRef.current || isFocused) return;
    
    const rendered = renderContent(value);
    if (editorRef.current.innerHTML !== rendered) {
      editorRef.current.innerHTML = rendered;
    }
  }, [value, variables, isFocused, getVarValue, templateLanguage]);

  useEffect(() => {
    applyFocusedPill(focusedVarName);
  }, [focusedVarName, variables, applyFocusedPill]);

  // Extract placeholder-based text from the editor, skipping pill display values
  const extractText = () => {
    if (!editorRef.current) return '';

    let result = '';

    const append = (text = '') => {
      if (!text) return;
      result += text;
    };

    const ensureTrailingNewline = () => {
      if (!result.endsWith('\n')) {
        result += '\n';
      }
    };

    const traverse = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parentElement = child.parentElement;
          if (parentElement && parentElement.closest('.var-pill')) {
            return;
          }
          append(child.textContent ?? '');
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child;
          if (element.classList.contains('var-pill')) {
            const varName = element.getAttribute('data-var');
            const placeholder = element.getAttribute('data-value') || (varName ? `<<${varName}>>` : '');
            append(placeholder);
          } else if (element.tagName === 'BR') {
            append('\n');
          } else {
            const isBlock = BLOCK_ELEMENTS.has(element.tagName);
            if (isBlock && result && !result.endsWith('\n')) {
              append('\n');
            }
            traverse(element);
            if (isBlock) {
              ensureTrailingNewline();
            }
          }
        }
      });
    };

    traverse(editorRef.current);

    const normalized = result.replace(/\u00a0/g, ' ');
    if (normalized.endsWith('\n') && !normalized.endsWith('\n\n')) {
      return normalized.slice(0, -1);
    }
    return normalized;
  };

  const handleInput = () => {
    const text = extractText();

    const pillElements = editorRef.current?.querySelectorAll('.var-pill');
    const updates = {};
    let hasChanges = false;

    if (pillElements) {
      pillElements.forEach((pill) => {
        const varName = pill.getAttribute('data-var');
        if (!varName) return;

        const rawText = pill.textContent ?? '';
        const normalizedText = rawText
          .replace(/\u00a0/g, ' ')
          .replace(/[\r\n]+/g, ' ');
        const trimmed = normalizedText.trim();
        const placeholder = `<<${varName}>>`;
        let newValue = normalizedText;

        if (!trimmed || trimmed === placeholder) {
          newValue = '';
          if (rawText !== placeholder) {
            pill.textContent = placeholder;
          }
          pill.classList.remove('filled');
          pill.classList.add('empty');
        } else {
          pill.classList.add('filled');
          pill.classList.remove('empty');
        }

        pill.setAttribute('data-display', newValue);

        if ((variables?.[varName] || '') !== newValue) {
          hasChanges = true;
        }

        updates[varName] = newValue;
      });
    }

    if (hasChanges && typeof onVariablesChange === 'function') {
      onVariablesChange(updates);
    }

    if (onChange) {
      onChange({ target: { value: text } });
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Defer to allow selection to settle
    requestAnimationFrame(() => {
      const selection = document.getSelection?.();
      const anchor = selection?.anchorNode || null;
      if (!editorRef.current || !anchor || !editorRef.current.contains(anchor)) return;
      const pillElement = anchor.nodeType === Node.ELEMENT_NODE
        ? anchor.closest?.('.var-pill')
        : anchor.parentElement?.closest?.('.var-pill');
      const varName = pillElement?.getAttribute('data-var') || null;
      if (varName) {
        applyFocusedPill(varName);
        emitFocusedVarChange(varName);
        // Only auto-select if not recently suppressed (e.g., after double-click)
        if (Date.now() >= (autoSelectSuppressedUntilRef.current || 0)) {
          queueAutoSelectForPill(pillElement, varName);
        }
      }
    });
  };

  const handleBlur = () => {
    setIsFocused(false);
    handleInput(); // Ensure final value is captured

    // Only clear focus if this window still has focus; otherwise keep remote highlight active
    if (typeof document !== 'undefined' ? document.hasFocus?.() !== false : true) {
      emitFocusedVarChange(null);
      applyFocusedPill(null);
    }

    autoSelectTrackerRef.current = { varName: null, timestamp: 0 };
  };

  // Auto-select pill content on mouse down to enable quick overwrite (match body editor)
  const handleMouseDown = (event) => {
    if (!editorRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const pillElement = target.closest?.('.var-pill');
    if (pillElement && editorRef.current.contains(pillElement)) {
      const clickCount = event.detail;
      const varName = pillElement.getAttribute('data-var') || null;
      // Single click: schedule select-all shortly. Double-click: cancel scheduled select and allow native caret.
      if (clickCount === 1) {
        if (clickSelectTimerRef.current) {
          clearTimeout(clickSelectTimerRef.current);
        }
        clickSelectTimerRef.current = setTimeout(() => {
          selectEntirePill(pillElement);
          clickSelectTimerRef.current = null;
        }, 220);
      } else if (clickCount >= 2) {
        if (clickSelectTimerRef.current) {
          clearTimeout(clickSelectTimerRef.current);
          clickSelectTimerRef.current = null;
        }
        // Suppress any auto-select behavior for a short window so caret stays inside
        autoSelectSuppressedUntilRef.current = Date.now() + 600;
      }
      emitFocusedVarChange(varName);
      applyFocusedPill(varName);
    }
  };

  const handleDoubleClick = (event) => {
    if (!editorRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const pillElement = target.closest?.('.var-pill');
    if (!pillElement || !editorRef.current.contains(pillElement)) return;

    // Prevent native word selection on double-click; place caret at click point
    event.preventDefault();

    try {
      const selection = document.getSelection?.();
      if (!selection) return;

      let range = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(event.clientX, event.clientY);
      } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      if (!range || !pillElement.contains(range.startContainer)) {
        // Fallback: place caret at end of the pill
        range = document.createRange();
        range.selectNodeContents(pillElement);
        range.collapse(false);
      }

      selection.removeAllRanges();
      selection.addRange(range);
      // Keep auto-select suppressed briefly so selectionchange won't reselect
      autoSelectSuppressedUntilRef.current = Date.now() + 600;
    } catch {}
  };

  const handlePaste = (event) => {
    if (!editorRef.current) return;

    event.preventDefault();

    const pastedText = event.clipboardData?.getData('text/plain') ?? '';
    if (!pastedText) return;

    const sanitized = convertPlainTextToHtml(pastedText);
    const selection = document.getSelection?.();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(sanitized);
      range.insertNode(fragment);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current.insertAdjacentHTML('beforeend', sanitized);
    }

    // Defer input handling to ensure DOM updates settle
    requestAnimationFrame(() => {
      handleInput();
    });
  };

  useEffect(() => {
    if (!isFocused || !editorRef.current) return;

    const handleSelectionChange = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const docHasFocus = typeof document === 'undefined' || !document.hasFocus || document.hasFocus();
      if (!docHasFocus) {
        return;
      }
      const selection = document.getSelection?.();
      if (!selection) {
        emitFocusedVarChange(null);
        applyFocusedPill(null);
        autoSelectTrackerRef.current = { varName: null, timestamp: 0 };
        return;
      }

      const anchor = selection.anchorNode;
      if (!anchor || !editor.contains(anchor)) {
        emitFocusedVarChange(null);
        applyFocusedPill(null);
        autoSelectTrackerRef.current = { varName: null, timestamp: 0 };
        return;
      }

      const pillElement = anchor.nodeType === Node.ELEMENT_NODE
        ? anchor.closest?.('.var-pill')
        : anchor.parentElement?.closest?.('.var-pill');
      const varName = pillElement?.getAttribute('data-var') || null;
      emitFocusedVarChange(varName);
      applyFocusedPill(varName);

      if (varName && selection.isCollapsed) {
        if (Date.now() >= (autoSelectSuppressedUntilRef.current || 0)) {
          queueAutoSelectForPill(pillElement, varName);
        }
      }

      if (!varName) {
        autoSelectTrackerRef.current = { varName: null, timestamp: 0 };
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [isFocused, emitFocusedVarChange, applyFocusedPill, queueAutoSelectForPill]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const selection = document.getSelection?.();
    if (!selection) {
      return;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode) {
      return;
    }

    const pillElement = anchorNode.nodeType === Node.ELEMENT_NODE
      ? anchorNode.closest?.('.var-pill')
      : anchorNode.parentElement?.closest?.('.var-pill');

    if (pillElement) {
      event.preventDefault();
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      className={`lexical-content-editable${variant === 'compact' ? ' lexical-content-editable--compact' : ''}`}
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      suppressContentEditableWarning
      data-placeholder={placeholder}
    />
  );
};

export default SimplePillEditor;
