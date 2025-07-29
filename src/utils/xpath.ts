export function clickByXPath(
  text: string,
  exactMatch: boolean = true,
): boolean {
  const xpath = exactMatch
    ? `//*[text()='${text}']`
    : `//*[contains(text(),'${text}')]`;

  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  );

  const element = result.singleNodeValue as HTMLElement;

  if (element) {
    element.click();
    return true;
  }

  return false;
}

// Usage examples
// clickByXPath("Submit", true); // Exact match
// clickByXPath("Click here", false); // Partial match
