// Hàm phụ: gửi yêu cầu và nhận kết quả JSON hoặc văn bản.
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

// Hàm phụ: gửi GET có token và nhận nội dung file dạng Blob.
async function requestFile(path) {
    const token = localStorage.getItem('accessToken');

    if (!token) {
        throw new Error('Bạn cần đăng nhập.');
    }

    const response = await fetch(`/api${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        let message = text;

        try {
            const data = JSON.parse(text);

            message = typeof data === 'string'
                ? data
                : data?.message || data?.detail || '';
        } catch {
            // Nếu lỗi không phải JSON thì giữ văn bản đã đọc.
        }

        throw new Error(
            message || `Không thể lấy tài liệu (${response.status}).`
        );
    }

    return response.blob();
}

export const api = {
    register(username, password) {
        return request('/auth/register', { username, password });
    },

    login(username, password) {
        return request('/auth/login', { username, password });
    },

    // GET: danh sách thư mục gốc hoặc thư mục con.
    folders(parentId = null) {
        const path = parentId === null
            ? '/folders'
            : `/folders?parentId=${encodeURIComponent(parentId)}`;

        return request(path, undefined, 'GET', true);
    },

    // GET: thông tin một thư mục.
    getFolder(id) {
        return request(`/folders/${id}`, undefined, 'GET', true);
    },

    // POST: tạo thư mục.
    createFolder(name, parentId = null) {
        return request('/folders', { name, parentId }, 'POST', true);
    },

    // PUT: sửa thư mục.
    updateFolder(id, name, parentId = null) {
        return request(
            `/folders/${id}`,
            { name, parentId },
            'PUT',
            true
        );
    },

    // PATCH: di chuyển thư mục.
    moveFolder(id, parentId = null) {
        return request(
            `/folders/${id}/move`,
            { parentId },
            'PATCH',
            true
        );
    },

    // DELETE: xóa thư mục.
    deleteFolder(id) {
        return request(`/folders/${id}`, undefined, 'DELETE', true);
    },

    // GET: danh sách tài liệu kèm metadata.
    documents(folderId) {
        return request(
            `/folders/${folderId}/documents`,
            undefined,
            'GET',
            true
        );
    },

    // GET: thông tin chi tiết một tài liệu.
    documentDetail(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}`,
            undefined,
            'GET',
            true
        );
    },

    // POST: upload file kèm metadata.
    uploadDocument(folderId, file, metadata) {
        if (!metadata?.title?.trim()) {
            throw new Error('Chưa có tên văn bản trong dữ liệu upload.');
        }

        const formData = new FormData();

        formData.append('file', file);
        formData.append('title', metadata.title.trim());
        formData.append('documentNumber', metadata.documentNumber ?? '');
        formData.append('documentType', metadata.documentType ?? '');
        formData.append('issuer', metadata.issuer ?? '');
        formData.append('keywords', metadata.keywords ?? '');
        formData.append('description', metadata.description ?? '');

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

    // PUT: sửa metadata.
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

    // PATCH: đổi tên file, bao gồm phần mở rộng.
    renameDocument(folderId, documentId, originalName) {
        return request(
            `/folders/${folderId}/documents/${documentId}/rename`,
            { originalName },
            'PATCH',
            true
        );
    },

    // PATCH: chuyển tài liệu sang thư mục đích.
    moveDocument(folderId, documentId, targetFolderId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/move`,
            { targetFolderId },
            'PATCH',
            true
        );
    },

    // DELETE: xóa mềm tài liệu.
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
    // POST: chạy OCR và lưu nội dung chữ.
    runOcr(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/ocr`,
            undefined,
            'POST',
            true
        );
    },

    // GET: lấy nội dung chữ đã lưu.
    getExtractedText(folderId, documentId) {
        return request(
            `/folders/${folderId}/documents/${documentId}/text`,
            undefined,
            'GET',
            true
        );
    },
    // GET: nội dung file để xem, giữ tên hàm đang dùng.
    documentContent(folderId, documentId) {
        return requestFile(
            `/folders/${folderId}/documents/${documentId}/content`
        );
    },

    // GET: nội dung file để tải xuống.
    downloadDocument(folderId, documentId) {
        return requestFile(
            `/folders/${folderId}/documents/${documentId}/download`
        );
    },
};