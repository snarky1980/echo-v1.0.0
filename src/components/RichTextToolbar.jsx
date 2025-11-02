import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { Button } from './ui/button.jsx';

const FONT_SIZE_OPTIONS = [
  { label: 'Small', value: '14px' },
  { label: 'Normal', value: '16px' },
  { label: 'Large', value: '18px' },
  { label: 'X-Large', value: '20px' }
];

const DEFAULT_FONT_SIZE = '16px';

const FONT_SIZE_COMMAND_MAP = {
  '14px': '2',
  '16px': '3',
  '18px': '4',
  '20px': '5'
};

const FONT_COMMAND_TO_PX = {
  '1': '12px',
  '2': '14px',
  '3': '16px',
  '4': '18px',
  '5': '20px',
  '6': '24px',
  '7': '28px'
};

const RichTextToolbar = ({ onCommand, className = '', disabled = false }) => {
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false
  });
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const toolbarRef = useRef(null);

  const normalizeFontSize = useCallback((computedSize) => {
    if (!computedSize) return DEFAULT_FONT_SIZE;
    const numeric = parseFloat(computedSize);
    if (!Number.isFinite(numeric)) return DEFAULT_FONT_SIZE;

    let closest = DEFAULT_FONT_SIZE;
    let delta = Number.POSITIVE_INFINITY;
    FONT_SIZE_OPTIONS.forEach(({ value }) => {
      const candidate = parseFloat(value);
      const diff = Math.abs(candidate - numeric);
      if (diff < delta) {
        delta = diff;
        closest = value;
      }
    });

    return closest;
  }, []);

  // Check current formatting state
  const updateFormatState = useCallback(() => {
    if (disabled) return;
    
    try {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline')
      });

      // Get font size from selection
      const range = selection.getRangeAt(0);
      let targetElement = null;

      if (range.startContainer.nodeType === Node.TEXT_NODE) {
        targetElement = range.startContainer.parentElement;
      } else if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        targetElement = range.startContainer;
      }

      if (targetElement) {
        const computedStyle = window.getComputedStyle(targetElement);
        setFontSize(normalizeFontSize(computedStyle.fontSize));
      }
    } catch (error) {
      console.warn('Error updating format state:', error);
    }
  }, [disabled, normalizeFontSize]);

  // Handle selection changes to update toolbar state
  useEffect(() => {
    const handleSelectionChange = () => {
      // Small delay to ensure DOM is updated after selection change
      setTimeout(updateFormatState, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateFormatState]);

  // Execute formatting command
  const executeCommand = useCallback((command, value = null) => {
    if (disabled) return;

    try {
      // For block-level commands, ensure the selection is not inside a var-pill
      const isBlockCommand = (
        command === 'insertUnorderedList' ||
        command === 'insertOrderedList' ||
        command === 'justifyLeft' ||
        command === 'justifyCenter' ||
        command === 'justifyRight' ||
        command === 'justifyFull'
      );

      if (isBlockCommand) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const anchorNode = range.startContainer;
          let el = anchorNode.nodeType === Node.ELEMENT_NODE
            ? anchorNode
            : anchorNode.parentElement;
          let pill = null;
          if (el && el.closest) {
            pill = el.closest('.var-pill');
          }

          if (pill) {
            // If caret is inside a pill, move it just after the pill so block command can apply
            const afterRange = document.createRange();
            afterRange.setStartAfter(pill);
            afterRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(afterRange);
          }
        }
      }

      // Execute command immediately while we still have selection
      document.execCommand(command, false, value);
      updateFormatState();
      
      // Then notify parent
      onCommand?.(command, value);
      
      // Trigger input event on the contentEditable element to sync with React state
      const activeElement = document.activeElement;
      if (activeElement && activeElement.isContentEditable) {
        const event = new Event('input', { bubbles: true });
        activeElement.dispatchEvent(event);
      }
    } catch (error) {
      console.warn('Error executing command:', command, error);
    }
  }, [disabled, onCommand, updateFormatState]);

  // Handle font size change
  const handleFontSizeChange = useCallback((newSize) => {
    if (disabled) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setFontSize(newSize);
      onCommand?.('fontSize', newSize);
      return;
    }

    const range = selection.getRangeAt(0);
    const commandValue = FONT_SIZE_COMMAND_MAP[newSize] || FONT_SIZE_COMMAND_MAP[DEFAULT_FONT_SIZE];

    try {
      document.execCommand('styleWithCSS', false, true);
    } catch (error) {
      // styleWithCSS not supported - continue with default behavior
    }

    document.execCommand('fontSize', false, commandValue);

    try {
      document.execCommand('styleWithCSS', false, false);
    } catch (error) {
      // Ignore if browser does not support toggling
    }

    const activeElement = document.activeElement?.isContentEditable
      ? document.activeElement
      : document.activeElement?.closest?.('[contenteditable="true"]');

    if (activeElement) {
      const fonts = activeElement.querySelectorAll('font[size]');
      fonts.forEach((fontEl) => {
        const span = document.createElement('span');
        const sizeAttr = fontEl.getAttribute('size');
        const mappedSize = FONT_COMMAND_TO_PX[sizeAttr] || newSize;
        span.style.fontSize = mappedSize;
        span.innerHTML = fontEl.innerHTML;
        fontEl.replaceWith(span);
      });
    }

    setFontSize(newSize);
    onCommand?.('fontSize', newSize);

    // Sync external state
    updateFormatState();

    if (document.activeElement && document.activeElement.isContentEditable) {
      const event = new Event('input', { bubbles: true });
      document.activeElement.dispatchEvent(event);
    }
  }, [disabled, onCommand, updateFormatState]);

  if (disabled) {
    return null;
  }

  return (
    <div 
      ref={toolbarRef}
      className={`flex items-center gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg ${className}`}
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-9 w-9 p-0 ${activeFormats.bold ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-5 w-5" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-9 w-9 p-0 ${activeFormats.italic ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-5 w-5" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-9 w-9 p-0 ${activeFormats.underline ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-5 w-5" />
        </Button>
      </div>

      {/* Lists removed by request */}

      {/* Alignment */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('justifyLeft')}
          title="Align Left"
        >
          <AlignLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('justifyCenter')}
          title="Align Center"
        >
          <AlignCenter className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('justifyRight')}
          title="Align Right"
        >
          <AlignRight className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => executeCommand('justifyFull')}
          title="Justify"
        >
          <AlignJustify className="h-5 w-5" />
        </Button>
      </div>

      {/* Font Size */}
      <div className="flex items-center gap-2">
        <Type className="h-5 w-5 text-slate-600" />
        <select
          value={fontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className="text-sm border border-slate-300 rounded px-3 py-1.5 bg-white cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          title="Font Size"
        >
          {FONT_SIZE_OPTIONS.map(size => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator removed by request */}
    </div>
  );
};

export default RichTextToolbar;