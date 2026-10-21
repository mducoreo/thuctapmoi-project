// Các request đang chờ dùng chung một lần refresh.
let refreshJob = null;
let sessionVersion = 0;

export const SESSION_EXPIRED_EVENT = 'app:session-expired';

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

// Dùng sau khi đăng nhập thành công.
export function saveSession(tokens) {
    if (!tokens?.accessToken) {
        throw new Error('Backend chưa trả về accessToken.');
    }

    sessionVersion += 1;

    localStorage.setItem('accessToken', tokens.accessToken);

    if (tokens.refreshToken) {
        localStorage.setItem('refreshToken', tokens.refreshToken);
    } else {
        localStorage.removeItem('refreshToken');
    }
}

// Dùng khi đăng xuất hoặc phiên không còn hợp lệ.
export function clearSession() {
    sessionVersion += 1;

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
}

// Ngăn request cũ tiếp tục sau khi đã đăng xuất/đổi tài khoản.
function requireSameSession(version) {
    if (version !== sessionVersion) {
        throw new Error('Phiên đăng nhập đã thay đổi.');
    }
}

function expireSession(version) {
    requireSameSession(version);

    clearSession();

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

    throw httpError(
        'Phiên đăng nhập đã hết hiệu lực. Hãy đăng nhập lại.',
        401
    );
}

async function readData(response) {
    const text = await response.text();

    try {
        return text ? JSON.parse(text) : null;
    } catch {
        return text;
    }
}

function responseError(response, data) {
    const message = typeof data === 'string'
        ? data
        : data?.message || data?.detail;

    return httpError(
        message || `Yêu cầu thất bại (${response.status}).`,
        response.status
    );
}

// Lấy access token mới bằng refresh token.
async function refreshAccessToken(version) {
    requireSameSession(version);

    if (refreshJob?.version === version) {
        return refreshJob.promise;
    }

    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
        return expireSession(version);
    }

    const job = {
        version,
        promise: null,
    };

    job.promise = (async () => {
        // Gọi fetch trực tiếp để tránh refresh gọi lại chính nó.
        const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        });

        requireSameSession(version);

        // Backend từ chối refresh token.
        if ([400, 401, 403].includes(response.status)) {
            return expireSession(version);
        }

        const data = await readData(response);

        requireSameSession(version);

        // Lỗi máy chủ: báo lỗi nhưng giữ phiên để thử lại.
        if (!response.ok) {
            throw responseError(response, data);
        }

        if (!data?.accessToken) {
            throw new Error(
                'API refresh chưa trả về accessToken.'
            );
        }

        // Không khôi phục phiên cũ nếu đã đổi phiên trong lúc chờ.
        if (
            localStorage.getItem('refreshToken') !== refreshToken
        ) {
            throw new Error('Phiên đăng nhập đã thay đổi.');
        }

        localStorage.setItem('accessToken', data.accessToken);

        if (data.refreshToken) {
            localStorage.setItem(
                'refreshToken',
                data.refreshToken
            );
        }

        return data.accessToken;
    })();

    refreshJob = job;

    try {
        return await job.promise;
    } finally {
        if (refreshJob === job) {
            refreshJob = null;
        }
    }
}

// Dùng chung cho JSON, upload FormData và lấy file.
async function fetchWithSession(path, options, needsToken) {
    if (!needsToken) {
        return fetch(`/api${path}`, options);
    }

    const version = sessionVersion;

    let token = localStorage.getItem('accessToken');

    if (!token) {
        token = await refreshAccessToken(version);
    }

    requireSameSession(version);

    const send = accessToken => fetch(`/api${path}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
        },
    });

    let response = await send(token);

    requireSameSession(version);

    if (response.status !== 401) {
        return response;
    }

    // Có thể request khác đã refresh xong trước khi 401 này về.
    const currentToken = localStorage.getItem('accessToken');

    if (currentToken && currentToken !== token) {
        token = currentToken;
    } else {
        token = await refreshAccessToken(version);
    }

    requireSameSession(version);

    // Chỉ gửi lại một lần, không lặp vô hạn.
    response = await send(token);

    requireSameSession(version);

    if (response.status === 401) {
        return expireSession(version);
    }

    return response;
}

// Gửi yêu cầu và nhận JSON hoặc văn bản.
async function request(
    path,
    body,
    method = 'POST',
    needsToken = false
) {
    const headers = {};
    const isFormData = body instanceof FormData;

    if (body !== undefined && !isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetchWithSession(
        path,
        {
            method,
            headers,
            body: body === undefined
                ? undefined
                : isFormData
                    ? body
                    : JSON.stringify(body),
        },
        needsToken
    );

    const data = await readData(response);

    if (!response.ok) {
        throw responseError(response, data);
    }

    return data;
}

// Lấy file dạng Blob, cũng tự refresh nếu access token hết hạn.
async function requestFile(path) {
    const response = await fetchWithSession(
        path,
        { method: 'GET' },
        true
    );

    if (!response.ok) {
        throw responseError(
            response,
            await readData(response)
        );
    }

    return response.blob();
}

// Tìm tên, metadata, nội dung OCR, lọc và phân trang.
export function searchDocuments(filters = {}) {
    const params = new URLSearchParams();

    const keys = [
        'keyword',
        'ocrKeyword',
        'folderId',
        'documentNumber',
        'documentType',
        'issuer',
        'issuedDateFrom',
        'issuedDateTo',
    ];

    for (const key of keys) {
        const value = filters[key];

        if (value !== undefined && value !== null) {
            const text = String(value).trim();

            if (text !== '') {
                params.set(key, text);
            }
        }
    }

    params.set('page', String(filters.page ?? 0));
    params.set('size', String(filters.size ?? 10));

    return request(
        `/documents/search?${params.toString()}`,
        undefined,
        'GET',
        true
    );
}

export const api = {
    register(username, password) {
        return request('/auth/register', { username, password });
    },

    login(username, password) {
        return request('/auth/login', { username, password });
    },

    me() {
        return request('/auth/me', undefined, 'GET', true);
    },

    // Quản lý tài khoản.
    adminUsers(keyword = '', page = 0, size = 10) {
        const params = new URLSearchParams({
            keyword,
            page: String(page),
            size: String(size),
        });

        return request(
            `/admin/users?${params.toString()}`,
            undefined,
            'GET',
            true
        );
    },

    changeUserRole(id, role) {
        return request(
            `/admin/users/${id}/role`,
            { role },
            'PATCH',
            true
        );
    },

    changeUserEnabled(id, enabled) {
        return request(
            `/admin/users/${id}/enabled`,
            { enabled },
            'PATCH',
            true
        );
    },

    // Thư mục.
    folders(parentId = null) {
        const path = parentId === null
            ? '/folders'
            : `/folders?parentId=${encodeURIComponent(parentId)}`;

        return request(path, undefined, 'GET', true);
    },

    getFolder(id) {
        return request(`/folders/${id}`, undefined, 'GET', true);
    },

    createFolder(name, parentId = null) {
        return request(
            '/folders',
            { name, parentId },
            'POST',
            true
        );
    },

    updateFolder(id, name, parentId = null) {
        return request(
            `/folders/${id}`,
            { name, parentId },
            'PUT',
            true
        );
    },

    moveFolder(id, parentId = null) {
        return request(
            `/folders/${id}/move`,
            { parentId },
            'PATCH',
            true
        );
    },

    deleteFolder(id) {
        return request(
            `/folders/${id}`,
            undefined,
            'DELETE',
            true
        );
    },

    // Tài liệu.
    documents(folderId) {
        return request(
            `/folders/${folderId}/documents`,
            undefined,
            'GET',
            true
        );
    },

    searchDocuments,

    documentDetail(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}`,
            undefined,
            'GET',
            true
        );
    },

    uploadDocument(folderId, file, metadata) {
        if (!metadata?.title?.trim()) {
            throw new Error(
                'Chưa có tên văn bản trong dữ liệu upload.'
            );
        }

        const formData = new FormData();

        formData.append('file', file);
        formData.append('title', metadata.title.trim());
        formData.append(
            'documentNumber',
            metadata.documentNumber ?? ''
        );
        formData.append(
            'documentType',
            metadata.documentType ?? ''
        );
        formData.append('issuer', metadata.issuer ?? '');
        formData.append('keywords', metadata.keywords ?? '');
        formData.append(
            'description',
            metadata.description ?? ''
        );

        if (metadata.issuedDate) {
            formData.append('issuedDate', metadata.issuedDate);
        }

        return request(
            `/folders/${folderId}/documents`,
            formData,
            'POST',
            true
        );
    },

    updateDocumentMetadata(folderId, documentId, metadata) {
        const body = {
            title: metadata.title ?? '',
            documentNumber: metadata.documentNumber ?? '',
            documentType: metadata.documentType ?? '',
            issuedDate: metadata.issuedDate || null,
            issuer: metadata.issuer ?? '',
            keywords: metadata.keywords ?? '',
            description: metadata.description ?? '',
        };

        return request(
            `/folders/${folderId}/documents/${documentId}/metadata`,
            body,
            'PUT',
            true
        );
    },

    renameDocument(folderId, documentId, originalName) {
        return request(
            `/folders/${folderId}/documents/${documentId}/rename`,
            { originalName },
            'PATCH',
            true
        );
    },

    moveDocument(folderId, documentId, targetFolderId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/move`,
            { targetFolderId },
            'PATCH',
            true
        );
    },

    deleteDocument(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}`,
            undefined,
            'DELETE',
            true
        );
    },

    permanentDeleteDocument(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/permanent`,
            undefined,
            'DELETE',
            true
        );
    },

    // OCR.
    runOcr(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/ocr`,
            undefined,
            'POST',
            true
        );
    },

    getExtractedText(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/text`,
            undefined,
            'GET',
            true
        );
    },

    updateExtractedText(folderId, documentId, extractedText) {
        return request(
            `/folders/${folderId}/documents/${documentId}/text`,
            { extractedText },
            'PUT',
            true
        );
    },

    // Xem và tải file.
    documentContent(folderId, documentId) {
        return requestFile(
            `/folders/${folderId}/documents/${documentId}/content`
        );
    },

    downloadDocument(folderId, documentId) {
        return requestFile(
            `/folders/${folderId}/documents/${documentId}/download`
        );
    },
    // Ghi nhận người dùng yêu cầu in tài liệu.
    logPrint(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/print`,
            undefined,
            'POST',
            true
        );
    },
};