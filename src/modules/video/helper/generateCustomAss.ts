export const generateCustomAssContent = (eventText: string, style: string) => `
[Script Info]
Title: Custom Subtitle
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
${style}

${eventText}
`;
