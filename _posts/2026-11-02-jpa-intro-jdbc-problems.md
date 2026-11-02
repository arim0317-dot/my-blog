---
layout: post
title: "JDBC로 조회할 때 겪는 4가지 불편함, JPA는 어떻게 풀까? (패러다임 불일치와 동일성 보장)"
date: 2026-11-02 13:30:00 +0900
categories: [JPA]
tags: [jpa, orm, jdbc, entity, spring-data-jpa]
mermaid: true
module: "Module 2"
---

## 들어가며 (Situation)

`09_JPA/chap01-jpa-intro`는 JPA를 바로 쓰기 전에 **"JDBC만 쓰면 뭐가 불편한가?"** 를 먼저 보여 준다. 같은 메뉴 DB(`menudb`의 `tbl_menu`, `tbl_category`)를 두 방식으로 조회해 비교한다.

| 단계 | 패키지 | 내용 |
|---|---|---|
| 1 | `section01.jdbc` | JDBC로 직접 구현 → 문제점 4가지 체감 |
| 2 | `section02` | JPA(엔티티 + `EntityManager`)로 같은 일을 구현 → 문제 해결 |

비유로 시작한다. **외국어(SQL)로만 주문받는 가게**에서, 한국어(Java 객체)로 일하는 점원이 매번 **통역(JDBC 코드)** 을 직접 하고 있다고 하자. JPA는 그 통역을 **자동 통역사**가 맡게 하는 것이다.

| 개념 | 설명 |
|---|---|
| JDBC | SQL을 직접 쓰고, 결과(`ResultSet`)를 객체에 **손으로 옮겨 담는다** |
| **ORM** (Object Relational Mapping) | **객체와 테이블을 매핑**해 변환을 자동화하는 기술 |
| **JPA** | 자바 진영의 **ORM 표준 명세**(수업 주석: "자바 진영의 ORM 기술 표준") |
| Hibernate | JPA를 구현한 대표 구현체. 스프링 부트의 `spring-boot-starter-data-jpa`가 기본으로 사용한다 |

사용한 설정은 `build.gradle` 기준으로 `spring-boot-starter-data-jpa`, `mysql-connector-j`, Lombok이다(Spring Boot 4.1.2, Java 21).

## 문제 상황 (Task)

메뉴 조회 기능을 JDBC로 만들었더니 이런 문제가 생겼다. 코드 주석이 정리한 4가지다.

1. **같은 코드가 계속 반복**된다 (연결, 실행, 결과 변환)
2. 요구사항이 바뀌면 **SQL → 객체 → 매핑 코드가 연쇄로** 바뀐다
3. 테이블 구조와 객체 구조가 **다르게 생겨서** 객체를 자연스럽게 탐색할 수 없다
4. 같은 행을 두 번 조회하면 **서로 다른 객체**가 된다

## 해결 과정 (Action)

### 1. JDBC의 4가지 문제 (`JdbcProblem`)

#### 문제 1 — 반복되는 JDBC 코드와 수작업 매핑

```java
try (Connection con = dataSource.getConnection();
     Statement stmt = con.createStatement();
     ResultSet rset = stmt.executeQuery(query)) {

    while (rset.next()) {
        Menu menu = new Menu();
        menu.setMenuCode(rset.getInt("menu_code"));          // 컬럼 → 필드, 하나씩 옮겨 담기
        menu.setMenuName(rset.getString("menu_name"));
        menu.setMenuPrice(rset.getInt("menu_price"));
        menu.setCategoryCode(rset.getInt("category_code"));
        menu.setOrderableStatus(rset.getString("orderable_status"));
        menuList.add(menu);
    }
}
```

연결을 얻고 닫는 코드, SQL 작성, 컬럼 하나하나 옮기기. **조회 메소드마다** 이 구조가 복사된다. 컬럼이 20개면 `rset.getXxx`도 20줄이다.

#### 문제 2 — SQL에 의존적인 개발

요구사항이 바뀐다: *"메뉴 조회 시 카테고리 이름도 보여주세요."*

| 바뀌어야 하는 것 | 내용 |
|---|---|
| SQL | `JOIN tbl_category` 추가 |
| 담을 객체 | `MenuCategoryDTO`라는 **새 클래스** 작성 |
| 매핑 코드 | `ResultSet → MenuCategoryDTO` 코드 **다시 작성** |

수업 주석의 표현대로 "객체 중심이 아닌 **SQL(테이블) 중심**으로 개발"하게 된다. 조회 모양이 늘 때마다 DTO와 매핑 코드가 함께 늘어난다.

```mermaid
flowchart LR
    R["요구사항 변경"] --> S["SQL 수정(JOIN)"]
    S --> D["새 DTO 클래스"]
    D --> M["매핑 코드 재작성"]
```

#### 문제 3 — 패러다임 불일치

가장 핵심적인 문제다. **데이터베이스와 객체지향은 관계를 표현하는 방식이 다르다.**

| 관점 | 메뉴와 카테고리의 관계 표현 |
|---|---|
| 테이블(SQL) | `tbl_menu`가 `category_code`라는 **값(FK)** 을 가진다 |
| 객체(Java) | `Menu`가 `Category` **객체 자체**를 필드로 가진다 → `menu.getCategory()` |

JDBC용 `Menu`는 테이블을 따라 만들었으므로 `categoryCode`(정수)만 갖는다. 카테고리 정보가 필요하면 이렇게 해야 한다.

```java
Menu menu = findMenuByMenuCode(menuCode);                          // SQL 1번
Category category = findCategoryByCategoryCode(menu.getCategoryCode());  // SQL 한 번 더, 직접 조립
```

`menu.getCategory().getCategoryName()`처럼 **객체를 따라가며 탐색**할 수 없다.

#### 문제 4 — 동일성 보장 문제

```java
Menu menu1 = findMenuByMenuCode(menuCode);
Menu menu2 = findMenuByMenuCode(menuCode);      // 같은 행, 다시 조회

menu1.setMenuName("이름 변경 테스트");
// menu1.getMenuName() → "이름 변경 테스트"
// menu2.getMenuName() → 원래 이름
```

DB에서는 같은 행인데 자바에는 **두 개의 다른 객체**가 생긴다. `menu1 == menu2`는 `false`, 한쪽을 바꿔도 다른 쪽은 모른다. 수업 주석: "한 객체에서 수정을 하게 되면 다른 객체는 수정을 알아차릴 수 없다."

### 2. JPA로 해결하기 (`section02`)

#### 2-1. 엔티티 클래스: 객체와 테이블을 연결하는 설명서

```java
@Entity                                // JPA가 관리하는 객체
@Table(name = "tbl_menu")              // 매핑될 테이블
@NoArgsConstructor
@AllArgsConstructor
@Getter
@ToString
public class Menu {

    @Id                                // PK
    @Column(name = "menu_code")
    private int menuCode;

    @Column(name = "menu_name")
    private String menuName;

    @Column(name = "menu_price")
    private int menuPrice;

    @ManyToOne                          // 메뉴(N) : 카테고리(1)
    @JoinColumn(name = "category_code") // FK 컬럼
    private Category category;          // ← 값이 아니라 객체!

    @Column(name = "orderable_status")
    private String orderableStatus;
}
```

| 어노테이션 | 의미 |
|---|---|
| `@Entity` | 이 클래스는 테이블과 매핑되는 엔티티 |
| `@Table(name=...)` | 매핑할 테이블 이름 |
| `@Id` | 기본키(PK) 필드 |
| `@Column(name=...)` | 컬럼 이름 매핑 |
| `@ManyToOne` | 다대일 관계 (메뉴 여러 개 : 카테고리 하나) |
| `@JoinColumn(name=...)` | 연결에 쓰는 FK 컬럼 |

`@NoArgsConstructor`는 편의가 아니라 **필요**다. JPA(Hibernate)는 엔티티를 만들 때 기본 생성자가 있어야 한다. `Category`도 같은 방식으로 `@Entity`, `@Table(name = "tbl_category")`를 붙였다.

#### 2-2. 해결 포인트 1 — SQL과 매핑 코드가 사라진다

```java
@PersistenceContext
private EntityManager manager;

public void findMenu(int menuCode) {
    Menu foundMenu = manager.find(Menu.class, menuCode);     // 이게 전부
    System.out.println(foundMenu);
}
```

`find(엔티티 타입, PK)` 한 줄이 **SQL 작성 + JDBC 코드 + 결과 → 객체 매핑**을 모두 대신한다. 수업 주석: "위 3가지 내용은 JPA를 사용했을 때 자동으로 수행해 준다."

`EntityManager`는 엔티티를 저장·조회·삭제하는 **JPA의 창구**다. 그 안쪽에 엔티티를 보관하는 **영속성 컨텍스트(Persistence Context)** 가 있고(다음 글에서 자세히), `@PersistenceContext`로 주입받는다.

#### 2-3. 해결 포인트 2 — 객체 그래프 탐색 (패러다임 불일치 해결)

```java
Menu foundMenu = manager.find(Menu.class, menuCode);
System.out.println(foundMenu);     // Menu에 Category 정보까지 함께 출력됨
```

`Menu`가 `Category` 객체를 필드로 가지므로, `menu.getCategory()`로 **객체를 따라가면서** 카테고리를 꺼낼 수 있다. 연관된 데이터를 가져오는 SQL(JOIN 등)은 JPA가 만든다. `@ToString`이 `category` 필드도 출력하므로 `Menu(... category=Category(...))` 모양이 나올 것으로 예상된다. 콘솔에 찍히는 SQL은 `show-sql: true` 설정 때문에 확인할 수 있다. (`@ManyToOne`은 기본적으로 즉시 로딩(EAGER)이라 JOIN이 함께 나갈 것으로 보이며, 실제 SQL은 직접 실행해 확인하자.)

#### 2-4. 해결 포인트 3 — 동일성 보장

```java
@Transactional(readOnly = true)
public void compareSameMenu(int menuCode) {

    Menu menu1 = manager.find(Menu.class, menuCode);     // 1번째 조회
    Menu menu2 = manager.find(Menu.class, menuCode);     // 2번째 조회

    // menu1 == menu2  →  true
    menu1.changeMenuName("테스트");
    // menu2.getMenuName() 도 "테스트" (같은 객체이므로)
}
```

주석의 설명: **같은 트랜잭션 안에서 같은 PK로 조회한 엔티티는 항상 같은 객체**다. 그래서 `menu1 == menu2`가 `true`이고 SQL도 **첫 조회에서 한 번만** 나갈 것으로 예상된다. 이 원리는 다음 글의 1차 캐시와 영속성 컨텍스트 덕분이다.

`@Transactional(readOnly = true)`의 의미도 정리한다.

| 부분 | 의미 |
|---|---|
| `@Transactional` | 메소드 시작 시 트랜잭션 시작, 정상 종료 시 commit, 예외 시 rollback을 자동 처리 |
| `readOnly = true` | **조회 전용** 트랜잭션 |

> `menu1.changeMenuName("테스트")`로 이름을 바꿨지만 `readOnly = true`라서 DB에는 UPDATE가 **반영되지 않을 것**으로 보인다. (읽기 전용 트랜잭션에서는 하이버네이트가 변경 내용을 flush하지 않는다. 이 글에서는 실제로 실행해 확인하지 않았다.) 이름 변경을 DB에 반영하는 방법(변경 감지)은 다음 글에서 다룬다.

### 3. 설정 파일 읽기: `application.yaml`

```yaml
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/menudb
    username: <계정>
    password: <비밀번호>
  jpa:
    show-sql: true              # JPA가 만든 SQL을 콘솔에 출력
    hibernate:
      ddl-auto: none            # 테이블 자동 생성/변경을 하지 않는다
    properties:
      hibernate:
        format_sql: true        # SQL을 보기 좋게 정렬해서 출력
```

| `ddl-auto` 값 | 의미 |
|---|---|
| `create` | 앱 실행 시 테이블을 **새로 생성** (기존 데이터 삭제) |
| `create-drop` | 실행 시 생성, **종료 시 삭제** |
| `update` | 엔티티 변경 사항을 기존 테이블에 반영 |
| `none` | 아무것도 하지 않음 (미리 만들어 둔 DDL 사용) |

이 프로젝트는 `none`이다. **실습 데이터가 들어 있는 기존 DB**를 지우지 않기 위해서다. `show-sql`과 `format_sql`을 켜 두면 "JPA가 실제로 어떤 SQL을 만드는지"를 눈으로 확인하며 배울 수 있다. 위 설정 중 `username`, `password`는 글에 적지 않았다. 계정 정보는 저장소에 올리지 않는 것이 안전하다.

### 4. JDBC vs JPA 한눈에 비교

| 문제 | JDBC | JPA |
|---|---|---|
| 반복 코드 | 연결·실행·`ResultSet` 매핑을 직접 | `manager.find(...)` 한 줄 |
| SQL | 직접 작성 | 기본 CRUD는 JPA가 생성 |
| 요구사항 변경 | SQL, DTO, 매핑 연쇄 수정 | 엔티티 구조 중심, 필요한 만큼만 수정 |
| 관계 표현 | `categoryCode` **값**(FK) | `Category` **객체**, `getCategory()` |
| 동일성 | 조회마다 **다른 객체** | 같은 트랜잭션에서 **같은 객체** |
| 스타일 | SQL(테이블) 중심 | 객체 중심 |

## 결과 (Result)

정량 지표(속도 등)는 측정하지 않았다. 대신 같은 "메뉴 하나 조회"를 구현한 코드의 구조를 비교했다. (소스의 구조를 본 것이며 직접 측정한 수치가 아니다.)

| 항목 | JDBC (`findMenuByMenuCode`) | JPA (`findMenu`) |
|---|---|---|
| 핵심 코드 | 연결 획득, `PreparedStatement`, 파라미터 설정, `ResultSet` 순회, 컬럼 5개 매핑 | `manager.find(Menu.class, menuCode)` |
| 카테고리까지 조회 | 쿼리를 한 번 더 작성하고 직접 연결 | `menu.getCategory()` |

| 질문 | 정리 |
|---|---|
| ORM이란? | 객체와 관계형 DB 테이블을 매핑해 변환을 자동화하는 기술 |
| JPA와 Hibernate의 관계 | JPA는 표준 명세, Hibernate는 그 구현체 |
| 엔티티란? | `@Entity`가 붙어 테이블과 매핑되는 클래스 |
| 패러다임 불일치란? | DB는 FK **값**, 객체는 참조 **객체**로 관계를 표현하는 차이 |
| 동일성 보장이란? | 같은 트랜잭션에서 같은 PK는 같은 객체 |

배운 점은 이렇다.

1. JPA는 "SQL을 안 써도 되는 기술"이 아니라 **"반복되는 통역을 자동화해서 객체 중심으로 생각하게 해 주는 기술"** 이다.
2. 객체지향과 관계형 DB의 **구조 차이**를 이해하고 있어야 `@ManyToOne` 같은 매핑이 왜 필요한지 보인다.
3. 편리함 뒤에는 JPA가 내부에서 동작하는 규칙(영속성 컨텍스트)이 있다. 그 규칙을 모르면 "왜 UPDATE가 안 나가지?" 같은 상황을 만난다. 다음 글들의 주제다.

## 더 학습하면 좋은 개념

- **영속성 컨텍스트(Persistence Context)와 1차 캐시** — 이 글의 "동일성 보장"이 가능한 원리다. 다음 글에서 자세히 다룬다.
- **연관관계 매핑 (`@OneToMany`, 양방향, 연관관계의 주인)** — 이 글의 `@ManyToOne`을 확장하는 핵심 주제다. 객체 관계 설계의 중심이 된다.
- **즉시 로딩(EAGER)과 지연 로딩(LAZY)** — `@ManyToOne`의 기본값과 성능 문제(N+1)를 이해하는 출발점이다.
- **JPQL과 Spring Data JPA Repository** — `find`로 풀 수 없는 조건 조회를 객체 기준 쿼리로 작성하는 방법이다. 이후 실무 개발의 대부분이다.
- **MyBatis와의 비교** — SQL을 직접 쓰되 매핑만 자동화하는 방식과 ORM의 철학 차이다. 어떤 상황에 무엇을 고를지 판단 기준이 된다.

## 참고 자료

- [Jakarta Persistence 3.2 명세](https://jakarta.ee/specifications/persistence/3.2/)
- [Hibernate ORM 공식 문서](https://hibernate.org/orm/documentation/)
- [Spring Data JPA 공식 문서](https://docs.spring.io/spring-data/jpa/reference/)
- [Spring Boot 공식 문서 - SQL Databases (JPA와 `ddl-auto`)](https://docs.spring.io/spring-boot/reference/data/sql.html)
- [Spring Framework 공식 문서 - `@Transactional`](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
- [JDBC 연결·Statement 글]({{ site.baseurl }}/2026/10/20/jdbc-statement-preparedstatement/)
