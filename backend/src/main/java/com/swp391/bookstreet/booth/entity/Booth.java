package com.swp391.bookstreet.booth.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "booths")
public class Booth {
    @Id
    @Column(name = "booth_id")
    private Long boothId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false,
            cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "booth_id", nullable = false)
    private Location location;

    @Column(name = "category_code", length = 50)
    private String categoryCode;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "image_url", columnDefinition = "text")
    private String imageUrl;

    protected Booth() {
    }

    public static Booth create(Location location, String categoryCode, String note,
            String imageUrl) {
        Booth booth = new Booth();
        booth.location = location;
        booth.categoryCode = categoryCode;
        booth.note = note;
        booth.imageUrl = imageUrl;
        return booth;
    }

    public void updateDetails(String categoryCode, String note, String imageUrl) {
        this.categoryCode = categoryCode;
        this.note = note;
        this.imageUrl = imageUrl;
    }

    public Long getBoothId() {
        return boothId;
    }

    public Location getLocation() {
        return location;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public String getNote() {
        return note;
    }

    public String getImageUrl() {
        return imageUrl;
    }
}
