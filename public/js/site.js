(() => {
  "use strict";
  const content = document.querySelector(".post-content");
  const contents = document.querySelector("#article-contents");
  if (content && contents) {
    content.querySelectorAll("h2, h3, h4, h5, h6").forEach((heading, index) => {
      const title = heading.textContent.trim();
      if (!heading.id) heading.id = `section-${index + 1}`;
      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#${heading.id}`;
      anchor.setAttribute("aria-label", `Link to ${title}`);
      anchor.textContent = "#";
      heading.append(anchor);
      if (heading.tagName === "H2") {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${heading.id}`;
        link.textContent = title;
        item.append(link);
        contents.append(item);
      }
    });
    if (contents.children.length) document.querySelector(".contents-nav").hidden = false;
  }
  const query = document.querySelector("#archive-query");
  if (query) {
    const groups = [...document.querySelectorAll(".archive-year")];
    const entries = [...document.querySelectorAll(".archive-entry")].map(row => ({
      row, text: `${row.closest(".archive-year").dataset.year} ${row.textContent}`.toLocaleLowerCase()
    }));
    const status = document.querySelector("#archive-status");
    document.querySelector(".archive-search").hidden = false;
    query.addEventListener("input", () => {
      const value = query.value.trim().toLocaleLowerCase();
      let count = 0;
      entries.forEach(({ row, text }) => {
        row.hidden = !text.includes(value);
        if (!row.hidden) count++;
      });
      groups.forEach(group => { group.hidden = !group.querySelector(".archive-entry:not([hidden])"); });
      document.querySelector(".year-nav").hidden = Boolean(value);
      status.hidden = !value;
      status.textContent = count ? `${count} article${count === 1 ? "" : "s"} found.` : "No articles found. Try another title or year.";
    });
  }
})();
