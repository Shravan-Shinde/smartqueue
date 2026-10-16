import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Building2, Layers, Ticket, ChevronRight } from 'lucide-react';
import apiClient from '../../services/api';

/**
 * Interactive Global Search Component
 * Searches Organizations, Services/Departments, Queues, and Token IDs with debouncing and RBAC security.
 */
const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef(null);

  // Debounced Search API Call
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get('/search/global', {
          params: { q: query.trim() },
        });
        if (res.data?.success) {
          setResults(res.data.data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('[GLOBAL SEARCH ERROR]', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click & ESC key to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
  };

  const handleSelectResult = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const hasResults =
    results &&
    (results.organizations?.length > 0 ||
      results.departments?.length > 0 ||
      results.queues?.length > 0 ||
      results.myToken);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sq-warning" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search organizations, services, or token ID (e.g. SPA-104)..."
          className="w-full bg-sq-surface text-xs text-sq-textPrimary placeholder-[#A89C8C] rounded-xl pl-10 pr-9 py-2 border border-sq-warning focus:outline-none focus:border-sq-primary focus:ring-1 focus:ring-sq-primary transition-all"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 text-sq-primary animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-sq-muted hover:text-sq-textPrimary p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results Overlay Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-sq-bg border border-sq-borderStrong rounded-2xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {isLoading && !results ? (
            <div className="p-4 text-center text-xs text-sq-textSecondary flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-sq-primary animate-spin" /> Searching SmartQueue database...
            </div>
          ) : !hasResults ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-xs font-bold text-sq-textPrimary">No results found</p>
              <p className="text-[11px] text-sq-muted">
                No organizations, services, or tokens match "{query}".
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {/* Token Result */}
              {results.myToken && (
                <div>
                  <h6 className="px-2 text-[10px] font-extrabold text-sq-primary uppercase tracking-wider mb-1">
                    Matching Queue Token
                  </h6>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectResult(
                        results.myToken.isAuthorized && results.myToken.id
                          ? `/queue/${results.myToken.id}`
                          : `/discover`
                      )
                    }
                    className="w-full text-left p-2.5 rounded-xl bg-sq-surfaceSecondary hover:bg-sq-primarySubtle flex items-center justify-between border border-sq-borderStrong transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sq-primary text-sq-textPrimary flex items-center justify-center font-black text-xs">
                        <Ticket className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-sq-textPrimary flex items-center gap-2">
                          <span>Token {results.myToken.ticketNumber}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sq-primarySubtle text-sq-textSecondary">
                            {results.myToken.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-sq-textSecondary">
                          {results.myToken.organizationName} • {results.myToken.queueName}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sq-primary" />
                  </button>
                </div>
              )}

              {/* Organizations Results */}
              {results.organizations?.length > 0 && (
                <div>
                  <h6 className="px-2 text-[10px] font-bold text-sq-muted uppercase tracking-wider mb-1">
                    Organizations ({results.organizations.length})
                  </h6>
                  <div className="space-y-1">
                    {results.organizations.map((org) => (
                      <button
                        key={org._id}
                        type="button"
                        onClick={() => handleSelectResult(`/organizations/${org._id}`)}
                        className="w-full text-left p-2 rounded-xl hover:bg-sq-surfaceSecondary flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sq-textSecondary shrink-0" />
                          <div>
                            <p className="font-bold text-sq-textPrimary">{org.name}</p>
                            <p className="text-[10px] text-sq-muted">{org.category}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-sq-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Departments Results */}
              {results.departments?.length > 0 && (
                <div>
                  <h6 className="px-2 text-[10px] font-bold text-sq-muted uppercase tracking-wider mb-1">
                    Departments & Services ({results.departments.length})
                  </h6>
                  <div className="space-y-1">
                    {results.departments.map((dept) => (
                      <button
                        key={dept._id}
                        type="button"
                        onClick={() =>
                          handleSelectResult(
                            `/organizations/${dept.organizationId?._id || dept.organizationId}`
                          )
                        }
                        className="w-full text-left p-2 rounded-xl hover:bg-sq-surfaceSecondary flex items-center justify-between transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-sq-textSecondary shrink-0" />
                          <div>
                            <p className="font-bold text-sq-textPrimary">{dept.name}</p>
                            <p className="text-[10px] text-sq-muted">
                              {dept.organizationId?.name || 'Organization'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-sq-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
