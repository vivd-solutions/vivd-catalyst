export function createSystemInstructions(instructions: string, toolCount: number): string {
  if (toolCount === 0) {
    return instructions;
  }

  return `${instructions}

You have access to configured tools. Use them automatically when they are relevant. Do not ask the user to type debug commands or tool invocation syntax.`;
}
