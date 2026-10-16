import React, { useEffect, useRef, useState } from 'react';

/**
 * Modern Google Sign-In / Sign-Up Button Component using Google Identity Services (GSI)
 * Fallbacks gracefully if VITE_GOOGLE_CLIENT_ID is not configured.
 */
const GoogleAuthButton = ({ text = 'continue_with', onSuccess, onError, disabled = false }) => {
  const buttonRef = useRef(null);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const isSubmittingRef = useRef(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Validate whether a genuine client ID is configured
  const isConfigured = Boolean(
    googleClientId &&
    googleClientId.trim() !== '' &&
    googleClientId !== 'YOUR_ACTUAL_GOOGLE_CLIENT_ID' &&
    !googleClientId.startsWith('YOUR_') &&
    !googleClientId.includes('your_google_')
  );

  // Reset submitting flag when disabled state resets
  useEffect(() => {
    if (!disabled) {
      isSubmittingRef.current = false;
    }
  }, [disabled]);

  useEffect(() => {
    if (!isConfigured) return;

    let isMounted = true;
    let timeoutId = null;
    let attempts = 0;
    const maxAttempts = 50;

    // Check if google script is loaded
    const checkGsiScript = () => {
      if (!isMounted) return;
      if (window.google?.accounts?.id) {
        setIsGsiLoaded(true);
      } else if (attempts < maxAttempts) {
        attempts++;
        timeoutId = setTimeout(checkGsiScript, 100);
      } else {
        console.warn('Google Identity Services script did not load within timeout.');
      }
    };

    checkGsiScript();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !isGsiLoaded || !buttonRef.current) return;

    try {
      // Clear previous button render to avoid duplicate buttons
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (isSubmittingRef.current || disabled) return;
          if (response?.credential) {
            isSubmittingRef.current = true;
            onSuccess(response.credential);
          } else {
            onError?.('Failed to obtain Google credential');
          }
        },
      });

      // Calculate width clamped between 200 and 400 px per Google GSI specification
      const containerWidth = buttonRef.current?.offsetWidth || 380;
      const validWidth = Math.min(Math.max(containerWidth, 200), 400);

      // Render official Google button into the ref container
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'filled_black',
        text: text === 'signup_with' ? 'signup_with' : 'continue_with',
        size: 'large',
        logo_alignment: 'left',
        width: validWidth,
      });
    } catch (err) {
      console.error('Google Identity Services initialization error:', err);
      onError?.('Failed to initialize Google Sign-In.');
    }

    return () => {
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
    };
  }, [isConfigured, isGsiLoaded, googleClientId, text, onSuccess, onError, disabled]);

  const handleCustomButtonClick = () => {
    if (!isConfigured) {
      onError?.('Google Sign-In is not configured. Missing VITE_GOOGLE_CLIENT_ID environment variable.');
      return;
    }

    if (disabled || isSubmittingRef.current) return;

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      onError?.('Google Identity service is loading. Please try again in a moment.');
    }
  };

  return (
    <div className="w-full">
      {/* Official Google GSI Button Container (rendered when client ID is validly configured) */}
      {isConfigured && (
        <div ref={buttonRef} className="w-full flex justify-center mb-1 min-h-[40px]" />
      )}

      {/* Styled fallback button if client ID not configured or during custom trigger */}
      {!isConfigured && (
        <button
          type="button"
          onClick={handleCustomButtonClick}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border border-[#282936] bg-[#21222D] text-white hover:bg-[#282936] hover:border-[#8F9FF5]/50 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none shadow-sm"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{text === 'signup_with' ? 'Sign up with Google' : 'Continue with Google'}</span>
        </button>
      )}
    </div>
  );
};

export default GoogleAuthButton;
