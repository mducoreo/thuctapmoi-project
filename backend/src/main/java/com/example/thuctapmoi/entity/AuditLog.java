package com.example.thuctapmoi.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Nationalized;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private Long userId;

    @Nationalized
    @Column(nullable = false, length = 50, updatable = false)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private AuditAction action;

    @Column(nullable = false, updatable = false)
    private Long documentId;

    @Nationalized
    @Column(nullable = false, length = 255, updatable = false)
    private String documentName;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public AuditLog(
            Long userId,
            String username,
            AuditAction action,
            Long documentId,
            String documentName
    ) {
        this.userId = userId;
        this.username = username;
        this.action = action;
        this.documentId = documentId;
        this.documentName = documentName;
    }

    @PrePersist
    private void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}