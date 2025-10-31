import React, { useEffect, useRef, useState } from 'react';

const escapeHtml = (input = '') =>
  String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * SimplePillEditor - A simple contentEditable editor that displays variables as styled pills
 * This is a much simpler alternative to the Lexical framework
 */
const SimplePillEditor = ({ value, onChange, variables, placeholder }) => {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  // Render the content with pills
  const renderContent = (text) => {
    if (!text) return '';
    
    const regex = /<<([^>]+)>>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const varName = match[1];
      const varValue = variables?.[varName] || '';
      const isFilled = varValue.trim().length > 0;
      const displayValue = isFilled ? varValue : `<<${varName}>>`;
      const storedValue = `<<${varName}>>`;

      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push(escapeHtml(text.substring(lastIndex, match.index)));
      }

      // Add the pill
      const pillClass = `var-pill ${isFilled ? 'filled' : 'empty'}`;
      parts.push(`<span class="${pillClass}" data-var="${varName}" data-value="${escapeHtml(storedValue)}" contenteditable="false">${escapeHtml(displayValue)}</span>`);

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(escapeHtml(text.substring(lastIndex)));
    }

    return parts.join('');
  };

  // Update the editor when value changes externally
  useEffect(() => {
    if (!editorRef.current || isFocused) return;
    
    const rendered = renderContent(value);
    if (editorRef.current.innerHTML !== rendered) {
      editorRef.current.innerHTML = rendered;
    }
  }, [value, variables, isFocused]);

  // Extract plain text from the editor
  const extractText = () => {
    if (!editorRef.current) return '';
    
    let text = '';
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('var-pill')) {
        const varName = node.getAttribute('data-var');
        const value = node.getAttribute('data-value');
        text += value || `<<${varName}>>`;
      }
    }

    return text;
  };

  const handleInput = () => {
    const text = extractText();
    if (onChange) {
      onChange({ target: { value: text } });
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    handleInput(); // Ensure final value is captured
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      className="lexical-content-editable"
      onInput={handleInput}
      onFocus={handleFocus}
      onBlur={handleBlur}
      suppressContentEditableWarning
      data-placeholder={placeholder}
    />
  );
};

export default SimplePillEditor;
