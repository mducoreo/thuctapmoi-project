package com.example.thuctapmoi.service;

import com.example.thuctapmoi.entity.AuditAction;
import com.example.thuctapmoi.entity.AuditLog;
import com.example.thuctapmoi.entity.Document;
import com.example.thuctapmoi.entity.User;
import com.example.thuctapmoi.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void log(
            User actor,
            Document document,
            AuditAction action
    ) {
        AuditLog auditLog = new AuditLog(
                actor.getId(),
                actor.getUsername(),
                action,
                document.getId(),
                document.getOriginalName()
        );

        auditLogRepository.save(auditLog);
    }
}