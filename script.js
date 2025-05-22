// Mobil menü toggle
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');

menuBtn.addEventListener('click', () => {
    navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Header background on scroll
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        header.style.backgroundColor = '#ffffff';
        header.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    } else {
        header.style.backgroundColor = 'transparent';
        header.style.boxShadow = 'none';
    }
});

// Güvenlik önlemleri
function generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// CSRF token'ı oluştur ve forma ekle
document.addEventListener('DOMContentLoaded', () => {
    const csrfToken = generateCSRFToken();
    document.getElementById('csrf_token').value = csrfToken;
    // Token'ı session storage'a kaydet
    sessionStorage.setItem('csrf_token', csrfToken);
});

// Gelişmiş XSS koruması
function escapeHTML(str) {
    const htmlEscapes = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

// URL parametrelerini temizle
function sanitizeURL(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
    } catch {
        return '';
    }
}

// Form güvenliği güçlendirme
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Rate limiting kontrolü
        const now = Date.now();
        const lastSubmit = parseInt(sessionStorage.getItem('lastFormSubmit') || '0');
        if (now - lastSubmit < 5000) { // 5 saniye bekleme süresi
            alert('Lütfen form gönderimleri arasında bekleyin.');
            return;
        }

        // reCAPTCHA kontrolü
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            alert('Lütfen robot olmadığınızı doğrulayın.');
            return;
        }

        // CSRF token kontrolü
        const formToken = document.getElementById('csrf_token').value;
        const storedToken = sessionStorage.getItem('csrf_token');
        if (formToken !== storedToken) {
            alert('Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        // Form verilerini topla ve temizle
        const formData = new FormData(contactForm);
        const sanitizedData = {};
        
        // Gelişmiş input validasyonu
        for (let [key, value] of formData.entries()) {
            // Input tipine göre özel kontroller
            switch(key) {
                case 'name':
                    if (!/^[A-Za-zÇçĞğİıÖöŞşÜü\s]{2,50}$/.test(value)) {
                        alert('Lütfen geçerli bir isim girin.');
                        return;
                    }
                    break;
                case 'email':
                    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
                        alert('Lütfen geçerli bir e-posta adresi girin.');
                        return;
                    }
                    break;
                case 'message':
                    if (value.length < 10 || value.length > 1000) {
                        alert('Mesajınız 10-1000 karakter arasında olmalıdır.');
                        return;
                    }
                    // Tehlikeli karakterleri temizle
                    value = value.replace(/[<>]/g, '');
                    break;
            }
            sanitizedData[key] = escapeHTML(value.trim());
        }

        try {
            // Request kontrolü
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout

            // API çağrısı için güvenlik başlıkları
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': storedToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Frame-Options': 'DENY',
                    'X-Content-Type-Options': 'nosniff'
                },
                body: JSON.stringify({
                    ...sanitizedData,
                    recaptchaResponse,
                    timestamp: Date.now(),
                    company: 'Edaura'
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('Form gönderilemedi');
            }

            // Başarılı gönderim
            sessionStorage.setItem('lastFormSubmit', Date.now().toString());
            alert('Mesajınız başarıyla gönderildi. En kısa sürede size dönüş yapacağız.');
            contactForm.reset();
            grecaptcha.reset();
            
            // Yeni CSRF token oluştur
            const newToken = generateCSRFToken();
            document.getElementById('csrf_token').value = newToken;
            sessionStorage.setItem('csrf_token', newToken);

        } catch (error) {
            if (error.name === 'AbortError') {
                alert('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
            } else {
                console.error('Form gönderimi hatası:', error);
                alert('Mesajınız gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            }
        }
    });
}

// Link güvenliği
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
        const href = e.target.getAttribute('href');
        if (href && href.startsWith('http')) {
            // Harici linkleri kontrol et
            const sanitizedURL = sanitizeURL(href);
            if (!sanitizedURL) {
                e.preventDefault();
                console.error('Güvensiz URL engellendi:', href);
                return;
            }
            // Yeni sekmede aç
            e.target.setAttribute('rel', 'noopener noreferrer');
            e.target.setAttribute('target', '_blank');
        }
    }
});

// DOM manipülasyonu güvenliği
const originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
Element.prototype.insertAdjacentHTML = function(position, text) {
    const sanitized = escapeHTML(text);
    originalInsertAdjacentHTML.call(this, position, sanitized);
};

// Event listener memory leak önleme
function addSafeEventListener(element, event, callback) {
    const wrappedCallback = (e) => {
        try {
            callback(e);
        } catch (error) {
            console.error('Event handler error:', error);
        }
    };
    element.addEventListener(event, wrappedCallback);
    return () => element.removeEventListener(event, wrappedCallback);
}

// Content Security Policy (CSP) ihlallerini raporla
window.addEventListener('securitypolicyviolation', (e) => {
    console.error('CSP İhlali:', {
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        originalPolicy: e.originalPolicy
    });
});

// Animasyonlu sayaçlar
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Intersection Observer ile görünür olduğunda animasyonu başlat
const stats = document.querySelectorAll('.stat-item h3');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const target = entry.target;
            const finalValue = parseInt(target.textContent);
            animateValue(target, 0, finalValue, 2000);
            observer.unobserve(target);
        }
    });
}, { threshold: 0.5 });

stats.forEach(stat => observer.observe(stat));

// Servis kartları hover efekti
const serviceCards = document.querySelectorAll('.service-card');
serviceCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});

// Proje kartları hover efekti
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
}); 