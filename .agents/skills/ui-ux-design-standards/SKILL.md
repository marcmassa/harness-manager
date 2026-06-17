# Skill: VS Code Extension UI/UX Design Standards

This skill provides guidelines for creating beautiful, functional, and accessible user interfaces within VS Code Webviews.

## 1. Hierarchy and Spacing
- **Visual Rhythm**: Use a consistent spacing scale (e.g., 4px, 8px, 16px, 24px).
- **Grouping**: Use borders or subtle background changes to group related elements. Avoid "clumping" by providing ample white space (margin/padding).
- **Depth**: Use subtle shadows or borders (following VS Code theme variables) to provide depth to interactive elements like nodes.

## 2. Information Architecture
- **Scanning**: Users should be able to scan the interface quickly. Use bold headers and distinct icons for different entity types.
- **Progressive Disclosure**: Show high-level info first. Use panels, tooltips, or "read more" actions for deep details.
- **State Feedback**: Provide visual feedback for loading, empty, and error states.

## 3. Webview UI Toolkit Best Practices
- **Native Primitives**: Use `<vscode-panels>`, `<vscode-divider>`, and `<vscode-badge>` to blend with the editor.
- **Theming**: Always use CSS variables (`--vscode-*`). Test in both Light, Dark, and High Contrast themes.

## 4. Graph Visualization (React Flow)
- **Node Contrast**: Different types of nodes (Agent vs Skill) must be instantly recognizable through color and shape.
- **Edge Clarity**: Use animated edges for active processes and distinct colors/labels for different relationship types.
- **Layout**: Hierarchical layout is preferred for Agent structures. Ensure enough `ranksep` (vertical) and `nodesep` (horizontal) distance.

## 5. Interaction Design
- **Hover States**: Add hover effects to nodes to indicate interactivity.
- **Selection**: Highlight the selected node with a focus border (`--vscode-focusBorder`).
- **Drag and Drop**: Ensure smooth movement and intuitive creation flows.
