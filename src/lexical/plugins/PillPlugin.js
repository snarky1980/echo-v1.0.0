import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect } from 'react';
import { $createTextNode, $getRoot, TextNode } from 'lexical';
import { $createPillNode, PillNode } from '../nodes/PillNode.jsx';

function PillPlugin({ variables }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removePillNodes = () => {
      editor.update(() => {
        const root = $getRoot();
        const pills = root.getAllTextNodes().filter(node => node instanceof PillNode);
        pills.forEach(pill => pill.remove());
      });
    };

    const updatePills = () => {
      editor.update(() => {
        const root = $getRoot();
        const textNodes = root.getAllTextNodes().filter(node => !(node instanceof PillNode));

        textNodes.forEach(node => {
          const text = node.getTextContent();
          const regex = /<<([^>]+)>>/g;
          let match;
          let lastIndex = 0;
          const newNodes = [];

          while ((match = regex.exec(text)) !== null) {
            const varName = match[1];
            const varValue = variables[varName] || '';
            const isFilled = varValue.trim().length > 0;

            if (match.index > lastIndex) {
              newNodes.push($createTextNode(text.substring(lastIndex, match.index)));
            }
            newNodes.push($createPillNode(varName, isFilled ? varValue : `<<${varName}>>`, isFilled));
            lastIndex = regex.lastIndex;
          }

          if (lastIndex < text.length) {
            newNodes.push($createTextNode(text.substring(lastIndex)));
          }

          if (newNodes.length > 0) {
            node.replace(...newNodes);
          }
        });
      });
    };
    
    removePillNodes();
    updatePills();

  }, [variables, editor]);

  return null;
}

export default PillPlugin;
