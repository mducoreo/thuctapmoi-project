async function request(path, body) {
    const response = await fetch(`/api${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const text = await response.text();

    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!response.ok) {
        const message =
            typeof data === 'string'
                ? data
                : data?.message || data?.detail;

        throw new Error(
            message || `Yêu cầu thất bại (${response.status}).`
        );
    }

    return data;
}

export const api = {
    register(username, password) {
        return request('/auth/register', { username, password });
    },

    login(username, password) {
        return request('/auth/login', { username, password });
    },
};