package com.example.thuctapmoi.entity;

import jakarta.persistence.*;

@Entity
@Table(name="users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true,length = 50)
    private String username;

    @Column(nullable = false,length =225)
    private  String password;

    public User() {}

    public Long getId(){
        return id;
    }
    public String getUsername(){
        return username;
    }
    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }


}
