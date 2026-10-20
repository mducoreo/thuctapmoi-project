package com.example.thuctapmoi.repository;

import com.example.thuctapmoi.entity.UserRole;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import com.example.thuctapmoi.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Page<User> findByUsernameContainingIgnoreCase(
            String username,
            Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select u from User u " +
                    "where u.role = :role " +
                    "and u.enabled = true " +
                    "order by u.id"
    )
    List<User> lockActiveAdmins(@Param("role") UserRole role);
}