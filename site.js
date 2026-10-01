document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.nav-toggle');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton?.querySelector('.sr-only');

function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (menuLabel) menuLabel.textContent = 'Open navigation';
}

menuButton?.addEventListener('click', () => {
    const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(willOpen));
    navigation?.classList.toggle('is-open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
    if (menuLabel) menuLabel.textContent = willOpen ? 'Close navigation' : 'Open navigation';
});

navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
});

function updateHeader() {
    header?.classList.toggle('scrolled', window.scrollY > 24);
}
updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const reveals = document.querySelectorAll('.reveal');
if (!('IntersectionObserver' in window) || reducedMotion) {
    reveals.forEach((element) => element.classList.add('is-visible'));
} else {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
    reveals.forEach((element) => observer.observe(element));
}

const events = [
    { source: 'OT / MODBUS', command: 'Read temperature register 40021', verdict: 'allow' },
    { source: 'OT / MODBUS', command: 'Write dosing setpoint → 9,500% safe range', verdict: 'deny' },
    { source: 'AI AGENT / NOVA', command: 'send_email() / PII present in payload', verdict: 'approval' },
    { source: 'OT / MODBUS', command: 'Firmware push outside maintenance window', verdict: 'approval' },
    { source: 'AI AGENT / NOVA', command: 'write_file() / production environment', verdict: 'deny' },
    { source: 'OT / MODBUS', command: 'Read valve V-114 position', verdict: 'allow' }
];
const feed = document.getElementById('hero-feed');
const eventCount = document.getElementById('decision-count');
let eventIndex = 0;

function createEvent(event) {
    const row = document.createElement('div');
    row.className = 'feed-event';

    const copy = document.createElement('div');
    const source = document.createElement('div');
    source.className = 'feed-source';
    source.textContent = event.source;
    const command = document.createElement('div');
    command.className = 'feed-command';
    command.textContent = event.command;
    copy.append(source, command);

    const verdict = document.createElement('span');
    verdict.className = `feed-verdict ${event.verdict}`;
    verdict.textContent = event.verdict;
    row.append(copy, verdict);
    return row;
}

function pushEvent() {
    if (!feed) return;
    feed.appendChild(createEvent(events[eventIndex % events.length]));
    eventIndex += 1;
    while (feed.children.length > 3) feed.firstElementChild?.remove();
    if (eventCount) eventCount.textContent = `${String(Math.min(eventIndex, 999)).padStart(3, '0')} events`;
}

for (let i = 0; i < 3; i += 1) pushEvent();

let feedTimer;
function startFeed() {
    if (reducedMotion || feedTimer || document.hidden) return;
    feedTimer = window.setInterval(pushEvent, 3200);
}
function stopFeed() {
    if (!feedTimer) return;
    window.clearInterval(feedTimer);
    feedTimer = undefined;
}
document.addEventListener('visibilitychange', () => document.hidden ? stopFeed() : startFeed());
startFeed();
