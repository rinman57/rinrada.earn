(function () {
    const items = document.querySelectorAll('.timeline-item');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
        items.forEach((item) => item.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            });
        },
        { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );

    items.forEach((item) => observer.observe(item));
})();
