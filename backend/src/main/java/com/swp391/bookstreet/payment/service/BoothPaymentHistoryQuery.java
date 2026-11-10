package com.swp391.bookstreet.payment.service;

import com.swp391.bookstreet.payment.dto.BoothPaymentHistoryRow;
import com.swp391.bookstreet.payment.entity.BoothPaymentStatus;
import com.swp391.bookstreet.payment.entity.BoothPaymentTransactionType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only Booth Payment history shared by the Admin view (every Event) and the Organizer view (only the
 * Events that Organizer owns). It never changes a Payment.
 */
@Component
public class BoothPaymentHistoryQuery {
    private static final String FROM = """
            from BoothPayment p
            join p.boothHold h
            join h.boothRequest r
            join r.application a
            join a.partnerOrganization o
            join r.booth b
            join b.location l
            join Event e on e.eventId = a.eventId
            """;

    private final EntityManager entityManager;

    public BoothPaymentHistoryQuery(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /** @param organizerUserId when not null, only Payments of Events this Organizer owns are returned. */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public Page<BoothPaymentHistoryRow> page(BoothPaymentHistoryCriteria criteria, Long organizerUserId,
            boolean searchGatewayReference) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        String where = where(criteria, organizerUserId, searchGatewayReference, true, parameters);

        TypedQuery<Long> count = entityManager.createQuery("select count(p) " + FROM + where, Long.class);
        TypedQuery<BoothPaymentHistoryRow> rows = entityManager.createQuery("""
                select new com.swp391.bookstreet.payment.dto.BoothPaymentHistoryRow(
                    p.boothPaymentId, e.eventId, e.name, o.id, o.name, l.locationId, l.code, l.name,
                    p.transactionType, p.amount, p.status, p.reconciliationRequired, p.gatewayProvider,
                    p.gatewayTransactionRef, p.failureCode, p.createdAt, p.completedAt)
                """ + FROM + where + " order by " + criteria.orderBy(), BoothPaymentHistoryRow.class);
        parameters.forEach((name, value) -> {
            count.setParameter(name, value);
            rows.setParameter(name, value);
        });

        PageRequest pageable = PageRequest.of(criteria.page(), criteria.size());
        List<BoothPaymentHistoryRow> content = rows
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();
        return new PageImpl<>(content, pageable, count.getSingleResult());
    }

    /**
     * Money collected under the same filters except status: successful Payments of type PAYMENT, the same
     * definition the Admin dashboard uses for revenue (BR-119).
     */
    @Transactional(readOnly = true, propagation = Propagation.SUPPORTS)
    public BigDecimal collectedAmount(BoothPaymentHistoryCriteria criteria, Long organizerUserId,
            boolean searchGatewayReference) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        String where = where(criteria, organizerUserId, searchGatewayReference, false, parameters)
                + " and p.status = :collectedStatus and p.transactionType = :collectedType";
        parameters.put("collectedStatus", BoothPaymentStatus.SUCCESS);
        parameters.put("collectedType", BoothPaymentTransactionType.PAYMENT);
        TypedQuery<BigDecimal> sum = entityManager.createQuery(
                "select coalesce(sum(p.amount), 0) " + FROM + where, BigDecimal.class);
        parameters.forEach(sum::setParameter);
        return sum.getSingleResult();
    }

    private static String where(BoothPaymentHistoryCriteria criteria, Long organizerUserId,
            boolean searchGatewayReference, boolean includeStatus, Map<String, Object> parameters) {
        StringBuilder where = new StringBuilder(" where 1 = 1");
        if (organizerUserId != null) {
            where.append(" and e.organizerUserId = :organizerUserId");
            parameters.put("organizerUserId", organizerUserId);
        }
        if (includeStatus && criteria.status() != null) {
            where.append(" and p.status = :status");
            parameters.put("status", criteria.status());
        }
        if (criteria.eventId() != null) {
            where.append(" and e.eventId = :eventId");
            parameters.put("eventId", criteria.eventId());
        }
        if (criteria.reconciliationRequired() != null) {
            where.append(" and p.reconciliationRequired = :reconciliation");
            parameters.put("reconciliation", criteria.reconciliationRequired());
        }
        if (!criteria.search().isEmpty()) {
            // Organization, Booth code or Event name, and the gateway reference where the caller may see it.
            where.append(" and (lower(o.name) like :search escape '\\'")
                    .append(" or lower(l.code) like :search escape '\\'")
                    .append(" or lower(e.name) like :search escape '\\'");
            if (searchGatewayReference) {
                where.append(" or lower(coalesce(p.gatewayTransactionRef, '')) like :search escape '\\'");
            }
            where.append(')');
            parameters.put("search", "%" + escapeLike(criteria.search().toLowerCase(Locale.ROOT)) + "%");
        }
        if (criteria.createdFrom() != null) {
            where.append(" and p.createdAt >= :createdFrom");
            parameters.put("createdFrom", criteria.createdFrom());
        }
        if (criteria.createdBefore() != null) {
            where.append(" and p.createdAt < :createdBefore");
            parameters.put("createdBefore", criteria.createdBefore());
        }
        return where.toString();
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
