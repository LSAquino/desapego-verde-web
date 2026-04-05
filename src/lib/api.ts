const rawApiBaseUrl = import.meta.env.VITE_API_URL?.trim() ?? '';

const normalizedApiBaseUrl = rawApiBaseUrl.endsWith('/')
    ? rawApiBaseUrl.slice(0, -1)
    : rawApiBaseUrl;

export const apiUrl = (path: string) => {
    if (!normalizedApiBaseUrl) {
        return path;
    }

    return `${normalizedApiBaseUrl}${path}`;
};
