import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Type, Minus } from 'lucide-react';
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
      document.execCommand(command, false, value);
      updateFormatState();
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
      className={`flex items-center gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg ${className}`}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus from editor
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${activeFormats.bold ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => executeCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${activeFormats.italic ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => executeCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${activeFormats.underline ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => executeCommand('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 pr-2 border-r border-slate-300">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      {/* Font Size */}
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-slate-600" />
        <select
          value={fontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-1 bg-white"
          title="Font Size"
        >
          {FONT_SIZE_OPTIONS.map(size => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-1 pl-2 border-l border-slate-300">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
          onClick={() => executeCommand('insertHorizontalRule')}
          title="Insert Line"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default RichTextToolbar;