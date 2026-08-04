// FEAT-036 — pure prompt builders for the SDD generation surface.
//
// WHY THESE MOVED HERE
// The prompts were inline in `SddCoordinator`, which imports `vscode`. That was
// fine while the only consumer was `generateText()`, but the chat handoff has to
// rebuild the *same* prompt to push into the host editor's input — and a prompt
// that differs between the direct call and the handoff would silently produce
// different results depending on which button the user pressed.
//
// Extracting them makes the two paths share one source, and lets a test assert
// that they do.

export type SpecFile = 'requirements' | 'design' | 'tasks';

export interface FeatureMeta {
    id?: string;
    title?: string;
    description?: string;
    priority?: string;
}

/** Hard ceiling on prompt size, mirroring the original inline behaviour. */
export const MAX_SPEC_PROMPT_CHARS = 8192;

function truncate(prompt: string): string {
    return prompt.length > MAX_SPEC_PROMPT_CHARS
        ? prompt.slice(0, MAX_SPEC_PROMPT_CHARS) + '\n\n[... truncated ...]'
        : prompt;
}

/** `generateSpecDraft` — draft a spec file from the user's own description. */
export function buildSpecDraftPrompt(input: {
    file: SpecFile;
    userPrompt: string;
    templateContent: string;
    contextContent?: string;
    feature?: FeatureMeta;
}): string {
    const { file, userPrompt, templateContent, contextContent, feature } = input;
    let prompt =
        `You are writing a ${file} file for a software feature.\n\n` +
        `## User's Feature Description\n${userPrompt}\n\n` +
        `## Template (follow this structure)\n${templateContent}\n`;
    if (contextContent) {
        prompt += `\n## Previously Approved Content (use this as context)\n${contextContent.slice(0, 4096)}\n`;
    }
    if (feature) {
        prompt +=
            `\n## Feature Metadata\n- ID: ${feature.id}\n- Title: ${feature.title}\n` +
            `- Description: ${feature.description}\n- Priority: ${feature.priority}\n`;
    }
    prompt += "\n## Output\nReturn only the markdown body, no preamble. Follow the template's structure exactly.";
    return truncate(prompt);
}

export type DescriptionTarget = 'createDescription' | 'wizardPrompt' | 'editContent';

/** `generateFeatureDescription` — four shapes selected by mode and target. */
export function buildFeatureDescriptionPrompt(input: {
    title: string;
    mode: string;
    currentDescription: string;
    target: DescriptionTarget | string;
}): string {
    const { title, mode, currentDescription, target } = input;

    if (mode === 'refine' && currentDescription) {
        return `Refine and improve the following text. Keep it concise and professional.\n\nTitle: ${title}\n\nCurrent text:\n${currentDescription}\n\nReturn only the refined text, no preamble.`;
    }
    if (target === 'wizardPrompt' && title) {
        return `Write a detailed prompt (2-4 sentences) describing what to generate for a software feature titled "${title}". The prompt should describe the feature's purpose, key functionality, and expected outcomes. Return only the prompt text, no preamble.`;
    }
    if (target === 'editContent' && currentDescription) {
        return `Refine and improve the following specification content. Maintain the structure and markdown formatting. Improve clarity and completeness.\n\nTitle: ${title}\n\nCurrent content:\n${currentDescription}\n\nReturn only the refined content, no preamble.`;
    }
    return `Write a concise, one-paragraph description (2-3 sentences) for a software feature titled "${title}". Return only the description text, no preamble.`;
}
