(() => {
  'use strict';
  const box = document.getElementById('latest-list');
  if (!box) return;

  const COUNT = 6;
  if (!document.querySelector('.latest-source')) {
    box.insertAdjacentHTML('afterend',
      '<p class="latest-source">Cambodian internships, each linked to its original posting.</p>');
  }

  function show(list) {
    box.innerHTML = KISCard.cardsHtml(list);
    KISCard.wireLogos(box);
  }

  async function loadLatest() {
    box.innerHTML = '<p class="latest-msg">Loading latest internships...</p>';
    try {
      const feed = await getInternshipFeed(); // Cambodia internships by default
      const list = feed.jobs.slice(0, COUNT);
      if (!list.length) {
        box.innerHTML = '<p class="latest-msg">No internships found right now. Please check back soon.</p>';
        return;
      }
      window.KISLatestJobs = list;
      if (!window.getJobById) window.getJobById = (id) => window.KISLatestJobs.find((job) => String(job.id) === String(id));
      show(list);
    } catch {
      box.innerHTML = `<div class="latest-msg latest-error">
        <p>Could not load internships. Please check your connection and try again.</p>
        <button type="button" class="latest-retry">Retry</button></div>`;
      box.querySelector('.latest-retry').addEventListener('click', loadLatest);
    }
  }
  loadLatest();
})();
