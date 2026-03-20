import { useEffect, useState } from 'react';

function safeGetItem(key: string) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function safeRemoveItem(key: string) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

export function useLocalStorageState<T>(storageKey: string, getInitialValue: () => T) {
    const [value, setValue] = useState<T>(() => {
        const saved = safeGetItem(storageKey);
        if (saved == null) return getInitialValue();
        try {
            return JSON.parse(saved) as T;
        } catch {
            return getInitialValue();
        }
    });

    useEffect(() => {
        safeSetItem(storageKey, JSON.stringify(value));
    }, [storageKey, value]);

    const clear = () => {
        safeRemoveItem(storageKey);
        setValue(getInitialValue());
    };

    return { value, setValue, clear };
}
