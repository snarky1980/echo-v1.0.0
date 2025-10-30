import React, { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { PillNode } from './nodes/PillNode.jsx';
import PillPlugin from './plugins/PillPlugin';

// Plugin to update editor content when the external value changes,
// but only if the change wasn't triggered by the editor itself.
function UpdatePlugin({ value }) {
  const [editor] = useLexicalComposerContext();
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
        isMounted.current = true;
        // Set initial state
        editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(value || ''));
            root.append(paragraph);
        });
    } else {
        const editorState = editor.getEditorState();
        const editorText = editorState.read(() => $getRoot().getTextContent());

        if (editorText !== value) {
            editor.update(() => {
                const root = $getRoot();
                root.clear();
                const paragraph = $createParagraphNode();
                paragraph.append($createTextNode(value));
                root.append(paragraph);
            });
        }
    }
  }, [value, editor]);

  return null;
}

const LexicalEditor = ({ value, onChange, variables, placeholder }) => {
  const initialConfig = {
    namespace: 'LexicalEditor',
    nodes: [PillNode],
    onError: (error) => {
      console.error(error);
    },
    editorState: null, // Initial state is set by the UpdatePlugin
  };

  const handleChange = (editorState, editor) => {
    // We only want to trigger onChange if the change is from user interaction.
    // Checking if the editor has focus is a good proxy for this.
    if (!editor.isFocused()) {
      return;
    }
    
    editorState.read(() => {
      const root = $getRoot();
      const text = root.getTextContent();
      if (onChange && text !== value) {
        // Mimic textarea event object
        onChange({ target: { value: text } });
      }
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative editor-container">
        <RichTextPlugin
          contentEditable={<ContentEditable className="lexical-content-editable" />}
          placeholder={<div className="lexical-placeholder">{placeholder || 'Enter text...'}</div>}
        />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange={true} />
        <HistoryPlugin />
        <PillPlugin variables={variables} />
        <UpdatePlugin value={value} />
      </div>
    </LexicalComposer>
  );
};

export default LexicalEditor;
