function walkAndFind(
  text: string,
  exactMatch: boolean = true,
): HTMLElement | null {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textContent = node.textContent?.trim() || "";

    if (exactMatch ? textContent === text : textContent.includes(text)) {
      const parentElement = node.parentElement;
      if (parentElement) {
        return parentElement;
      }
    }
  }

  return null;
}

export function clickFoundText(
  text: string,
  exactMatch: boolean = true,
): boolean {
  const element = walkAndFind(text, exactMatch);

  if (element) {
    element.click();
    return true;
  }

  return false;
}
