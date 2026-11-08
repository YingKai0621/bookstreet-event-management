package com.swp391.bookstreet.partner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "partner_organizations")
public class PartnerOrganization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "partner_organization_id")
    private Long id;

    @Column(name = "representative_user_id", nullable = false, unique = true)
    private Long representativeUserId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "category_code", nullable = false, length = 50)
    private String categoryCode;

    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrganizationStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PartnerOrganization() {
    }

    public static PartnerOrganization createForRepresentative(
            Long representativeUserId,
            String name,
            String description,
            String categoryCode,
            String logoUrl,
            String contactEmail,
            String contactPhone,
            String address,
            Instant now
    ) {
        PartnerOrganization organization = new PartnerOrganization();
        organization.representativeUserId = representativeUserId;
        organization.updateProfile(
                name, description, categoryCode, logoUrl,
                contactEmail, contactPhone, address, now
        );
        organization.status = OrganizationStatus.ACTIVE;
        organization.createdAt = now;
        return organization;
    }

    public void updateProfile(
            String name,
            String description,
            String categoryCode,
            String logoUrl,
            String contactEmail,
            String contactPhone,
            String address,
            Instant now
    ) {
        this.name = name;
        this.description = description;
        this.categoryCode = categoryCode;
        this.logoUrl = logoUrl;
        this.contactEmail = contactEmail;
        this.contactPhone = contactPhone;
        this.address = address;
        this.updatedAt = now;
    }

    public void changeStatus(OrganizationStatus status, Instant now) {
        this.status = status;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getRepresentativeUserId() {
        return representativeUserId;
    }

    public void setRepresentativeUserId(Long representativeUserId) {
        this.representativeUserId = representativeUserId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public String getContactEmail() {
        return contactEmail;
    }

    public String getContactPhone() {
        return contactPhone;
    }

    public String getAddress() {
        return address;
    }

    public OrganizationStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public enum OrganizationStatus {
        ACTIVE,
        INACTIVE
    }
}
