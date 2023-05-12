const REFRESH_INTERVAL = 1000;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(refreshPage, REFRESH_INTERVAL);
});

function refreshPage() {
  fetch(document.location.href)
    .then((res) => {
      if (!res.ok) {
        setTimeout(refreshPage, REFRESH_INTERVAL);
        return;
      }
      return res.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(html, "text/html");
      document.body.innerHTML = parsedDoc.body.innerHTML;
      setTimeout(refreshPage, REFRESH_INTERVAL);
    });
}
