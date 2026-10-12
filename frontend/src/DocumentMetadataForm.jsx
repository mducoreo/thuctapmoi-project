export function emptyMetadata() {
    return {
        title: '',
        documentNumber: '',
        documentType: '',
        issuedDate: '',
        issuer: '',
        keywords: '',
        description: '',
    };
}

export default function DocumentMetadataForm({
                                                 value,
                                                 onChange,
                                                 disabled = false,
                                             }) {
    function change(field, text) {
        onChange((previous) => ({
            ...previous,
            [field]: text,
        }));
    }

    // Form nhập metadata dùng chung cho upload và sửa.
    return (
        <fieldset
            disabled={disabled}
            style={{
                border: 0,
                padding: 0,
                margin: 0,
                minWidth: 0,
                display: 'grid',
                gap: '12px',
                width: '100%',
            }}
        >
            <legend>Thông tin văn bản</legend>

            <label>
                Tên văn bản *
                <input
                    value={value.title}
                    required
                    maxLength={255}
                    onChange={(event) =>
                        change('title', event.target.value)
                    }
                />
            </label>

            <label>
                Số hiệu
                <input
                    value={value.documentNumber}
                    maxLength={100}
                    onChange={(event) =>
                        change('documentNumber', event.target.value)
                    }
                />
            </label>

            <label>
                Loại văn bản
                <input
                    value={value.documentType}
                    maxLength={100}
                    placeholder="Công văn, Quyết định, Thông báo..."
                    onChange={(event) =>
                        change('documentType', event.target.value)
                    }
                />
            </label>

            <label>
                Ngày ban hành
                <input
                    type="date"
                    value={value.issuedDate}
                    onChange={(event) =>
                        change('issuedDate', event.target.value)
                    }
                />
            </label>

            <label>
                Đơn vị/người ban hành
                <input
                    value={value.issuer}
                    maxLength={255}
                    onChange={(event) =>
                        change('issuer', event.target.value)
                    }
                />
            </label>

            <label>
                Từ khóa
                <input
                    value={value.keywords}
                    maxLength={500}
                    placeholder="Ví dụ: nhân sự, bổ nhiệm"
                    onChange={(event) =>
                        change('keywords', event.target.value)
                    }
                />
            </label>

            <label>
                Mô tả
                <textarea
                    value={value.description}
                    maxLength={2000}
                    rows={3}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                    onChange={(event) =>
                        change('description', event.target.value)
                    }
                />
            </label>
        </fieldset>
    );
}