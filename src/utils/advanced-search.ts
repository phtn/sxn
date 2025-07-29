interface TextSearchOptions {
  text: string;
  exactMatch?: boolean;
  tagNames?: string[];
  className?: string;
  caseSensitive?: boolean;
  clickable?: boolean;
}

function searchElement(options: TextSearchOptions): HTMLElement | null {
  const {
    text,
    exactMatch = true,
    tagNames = [],
    className,
    caseSensitive = false,
    clickable = true,
  } = options;

  const searchText = caseSensitive ? text : text.toLowerCase();
  let selector = "*";

  if (tagNames.length > 0) {
    selector = tagNames.join(", ");
  }

  const elements = document.querySelectorAll(selector);

  for (const element of elements) {
    const htmlElement = element as HTMLElement;
    let elementText = htmlElement.innerText.trim();

    if (!caseSensitive) {
      elementText = elementText.toLowerCase();
    }

    // Check text match
    const textMatches = exactMatch
      ? elementText === searchText
      : elementText.includes(searchText);

    if (!textMatches) continue;

    // Check className if specified
    if (className && !htmlElement.classList.contains(className)) {
      continue;
    }

    // Check if element is clickable
    if (clickable) {
      const isClickable =
        htmlElement.tagName.toLowerCase() === "button" ||
        htmlElement.tagName.toLowerCase() === "a" ||
        htmlElement.onclick !== null ||
        htmlElement.style.cursor === "pointer" ||
        htmlElement.getAttribute("role") === "button";

      if (!isClickable) continue;
    }

    return htmlElement;
  }

  return null;
}

function clickByTextAdvanced(options: TextSearchOptions): boolean {
  const element = searchElement(options);

  if (element) {
    // Simulate more realistic click
    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1,
    });

    element.dispatchEvent(clickEvent);
    return true;
  }

  return false;
}

// Usage examples
clickByTextAdvanced({
  text: "Submit Form",
  exactMatch: true,
  tagNames: ["button", "input"],
  clickable: true,
});

clickByTextAdvanced({
  text: "download",
  exactMatch: false,
  caseSensitive: false,
  className: "btn",
});
