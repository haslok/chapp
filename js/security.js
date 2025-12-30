// Security utilities for password hashing and rate limiting
// Uses Web Crypto API for secure password hashing

class SecurityUtils {
    // Hash password using SHA-256 with salt
    static async hashPassword(password) {
        try {
            // Generate a random salt
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Combine password and salt
            const encoder = new TextEncoder();
            const data = encoder.encode(password + saltHex);
            
            // Hash using SHA-256
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Return salt + hash (salt is needed for verification)
            return saltHex + ':' + hashHex;
        } catch (error) {
            console.error('Error hashing password:', error);
            throw new Error('Failed to hash password');
        }
    }
    
    // Verify password against stored hash
    static async verifyPassword(password, storedHash) {
        try {
            const [saltHex, hashHex] = storedHash.split(':');
            if (!saltHex || !hashHex) {
                return false;
            }
            
            // Hash the provided password with the stored salt
            const encoder = new TextEncoder();
            const data = encoder.encode(password + saltHex);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Compare hashes (timing-safe comparison)
            return this.timingSafeEqual(computedHash, hashHex);
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }
    
    // Timing-safe string comparison to prevent timing attacks
    static timingSafeEqual(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }
    
    // Rate limiting using localStorage
    static checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        const now = Date.now();
        const storageKey = `rate_limit_${key}`;
        
        try {
            const stored = localStorage.getItem(storageKey);
            let attempts = stored ? JSON.parse(stored) : { count: 0, resetTime: now + windowMs };
            
            // Reset if window expired
            if (now > attempts.resetTime) {
                attempts = { count: 0, resetTime: now + windowMs };
            }
            
            // Check if limit exceeded
            if (attempts.count >= maxAttempts) {
                const remainingTime = Math.ceil((attempts.resetTime - now) / 1000 / 60);
                return {
                    allowed: false,
                    remainingTime: remainingTime,
                    message: `Too many attempts. Please try again in ${remainingTime} minute(s).`
                };
            }
            
            // Increment attempt count
            attempts.count++;
            localStorage.setItem(storageKey, JSON.stringify(attempts));
            
            return { allowed: true, remainingAttempts: maxAttempts - attempts.count };
        } catch (error) {
            console.error('Rate limit error:', error);
            // On error, allow the request (fail open for better UX)
            return { allowed: true };
        }
    }
    
    // Clear rate limit
    static clearRateLimit(key) {
        try {
            localStorage.removeItem(`rate_limit_${key}`);
        } catch (error) {
            console.error('Error clearing rate limit:', error);
        }
    }
    
    // Sanitize input to prevent XSS
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }
    
    // Validate username format
    static validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: 'Username is required' };
        }
        
        const trimmed = username.trim();
        
        if (trimmed.length < 3) {
            return { valid: false, error: 'Username must be at least 3 characters' };
        }
        
        if (trimmed.length > 20) {
            return { valid: false, error: 'Username must be less than 20 characters' };
        }
        
        // Allow only alphanumeric, underscore, and hyphen
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            return { valid: false, error: 'Username can only contain letters, numbers, underscore, and hyphen' };
        }
        
        return { valid: true, username: trimmed };
    }
    
    // Validate password strength
    static validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: 'Password is required' };
        }
        
        if (password.length < 8) {
            return { valid: false, error: 'Password must be at least 8 characters' };
        }
        
        if (password.length > 128) {
            return { valid: false, error: 'Password is too long' };
        }
        
        // Check for at least one letter and one number
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        
        if (!hasLetter || !hasNumber) {
            return { valid: false, error: 'Password must contain at least one letter and one number' };
        }
        
        return { valid: true };
    }
}

// Make it globally available
window.SecurityUtils = SecurityUtils;
