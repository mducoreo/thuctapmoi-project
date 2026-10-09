async function request(path, body, method = 'POST', needsToken = false) {
    const headers = {};
    const isFormData = body instanceof FormData;

    if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    if (needsToken) {
        const token = localStorage.getItem('accessToken');

        if (!token) {
            throw new Error('Bạn cần đăng nhập.');
        }

        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api${path}`, {
        method,
        headers,
        body: body === undefined
            ? undefined
            : isFormData
                ? body
                : JSON.stringify(body),
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

    // GET: danh sách thư mục gốc hoặc thư mục con
    folders(parentId = null) {
        const path = parentId === null
            ? '/folders'
            : `/folders?parentId=${encodeURIComponent(parentId)}`;

        return request(path, undefined, 'GET', true);
    },

    // GET: thông tin một thư mục
    getFolder(id) {
        return request(`/folders/${id}`, undefined, 'GET', true);
    },

    // POST: tạo thư mục
    createFolder(name, parentId = null) {
        return request('/folders', { name, parentId }, 'POST', true);
    },

    // PUT: sửa thư mục
    updateFolder(id, name, parentId = null) {
        return request(
            `/folders/${id}`,
            { name, parentId },
            'PUT',
            true
        );
    },

    // PATCH: di chuyển thư mục
    moveFolder(id, parentId = null) {
        return request(
            `/folders/${id}/move`,
            { parentId },
            'PATCH',
            true
        );
    },

    // DELETE: xóa thư mục
    deleteFolder(id) {
        return request(`/folders/${id}`, undefined, 'DELETE', true);
    },

    // GET: danh sách tài liệu trong thư mục
    documents(folderId) {
        return request(
            `/folders/${folderId}/documents`,
            undefined,
            'GET',
            true
        );
    },

    // POST: upload file vào thư mục
    uploadDocument(folderId, file) {
        const formData = new FormData();
        formData.append('file', file);

        return request(
            `/folders/${folderId}/documents`,
            formData,
            'POST',
            true
        );
    },
};