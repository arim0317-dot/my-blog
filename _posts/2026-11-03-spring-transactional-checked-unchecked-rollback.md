---
layout: post
title: "예외가 났는데 롤백이 안 된다? @Transactional의 Checked·Unchecked 예외 처리"
date: 2026-11-03 11:10:00 +0900
categories: [Spring]
tags: [spring, transactional, rollback, checked-exception, rollbackfor]
mermaid: true
module: "Module 2"
---

## 들어가며 (Situation)

`MemberService.registMember()`에는 `@Transactional`이 붙어 있다. 수업 주석은 이렇게 설명한다.

> 메서드 실행 시 `begin()`, 정상 종료 시 `commit()`, 예외 발생 시 `rollback()`

그런데 "예외가 발생하면 롤백된다"는 문장에는 빠진 조건이 있다. **어떤 예외인가**에 따라 롤백 여부가 갈린다. 수업 코드에 남겨진 "블로그 작성 키워드" 중 첫 번째, **Checked 예외 / Unchecked 예외의 `@Transactional` 동작 방식**을 정리한다.

## 문제 상황 (Task)

1. 예외가 발생했는데도 데이터가 DB에 저장되는 경우가 있다고 한다. 언제인가?
2. Checked 예외와 Unchecked 예외는 무엇이 다르고, 스프링은 왜 이 둘을 다르게 취급하는가?
3. 원하는 대로 롤백 규칙을 바꾸려면 어떻게 하는가?

## 해결 과정 (Action)

### 1. 먼저 두 예외의 차이

| 구분 | Checked 예외 | Unchecked 예외 |
|---|---|---|
| 상속 | `Exception`의 하위 (`RuntimeException` 제외) | `RuntimeException`, `Error`의 하위 |
| 컴파일러 검사 | `throws` 선언 또는 `try-catch` **강제** | 강제하지 않음 |
| 예시 | `IOException`, `SQLException` | `NullPointerException`, `IllegalArgumentException` |

### 2. 스프링의 기본 롤백 규칙

스프링 공식 문서는 선언적 트랜잭션의 기본 동작을 다음과 같이 설명한다.

> In its default configuration, the Spring Framework's transaction infrastructure code marks a transaction for rollback only in the case of runtime, unchecked exceptions. That is, when the thrown exception is an instance or subclass of `RuntimeException`. (`Error` instances also, by default, result in a rollback). Checked exceptions that are thrown from a transactional method do not result in rollback in the default configuration.

> 출처: [Spring Framework 공식 문서 - Rolling Back a Declarative Transaction](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)

| 던져진 예외 | 기본 동작 |
|---|---|
| `RuntimeException`과 하위 | **rollback** |
| `Error`와 하위 | **rollback** |
| Checked 예외 (`Exception`, `IOException` 등) | **commit** (!) |

```mermaid
flowchart TD
    A[@Transactional 메서드 실행] --> B{예외 발생?}
    B -->|No| C[commit]
    B -->|Yes| D{rollbackFor / noRollbackFor<br/>에 해당?}
    D -->|Yes| E[지정한 규칙대로 처리]
    D -->|No| F{RuntimeException 또는 Error?}
    F -->|Yes| G[rollback]
    F -->|No, Checked| H[commit]
```

### 3. 직접 실험해 보기

아래는 `registMember`를 변형한 **예시 코드**다. (수업 원본 코드가 아니다.)

```java
// 예시 코드 1 : Checked 예외 → 기본 설정에서는 INSERT가 commit 된다
@Transactional
public int registMember(MemberRegistDTO dto) throws Exception {
    Member member = new Member(...);
    memberRepository.save(member);          // INSERT 실행 (IDENTITY)

    throw new Exception("회원 등록 후 오류");  // Checked
}
```

```java
// 예시 코드 2 : Unchecked 예외 → rollback
@Transactional
public int registMember(MemberRegistDTO dto) {
    Member member = new Member(...);
    memberRepository.save(member);

    throw new IllegalStateException("회원 등록 후 오류");  // Unchecked
}
```

예시 1은 `INSERT`가 이미 전송되었고, 예외가 Checked라서 롤백 대상이 아니므로 `tbl_member`에 행이 **남는다**. 예시 2는 같은 INSERT가 실행되더라도 롤백되어 행이 남지 않는다. 확인은 각 호출 후 `select * from tbl_member`로 직접 하면 된다.

> 저자 확인 필요: 위 두 실험은 이 블로그 글을 위한 예시 설계이며, 실제 실행 결과 로그는 직접 돌려 본 뒤 채워 넣는 것을 권장한다.

### 4. 왜 Checked 예외는 롤백하지 않는가

스프링 공식 문서는 이 기본값이 EJB의 관례를 따른 것이라고 설명한다. 해석하면, Checked 예외는 "**호출자가 처리할 수 있는, 예상 가능한 비즈니스 상황**"으로 보고(예: 잔액 부족), Unchecked 예외는 "**복구하기 어려운 오류**"로 보는 철학이다. 다만 현실에서는 반드시 이 구분이 맞지 않아서 설정으로 바꿀 수 있게 열어 둔다.

### 5. 규칙 바꾸기: rollbackFor / noRollbackFor

```java
// Checked 예외도 롤백하고 싶을 때
@Transactional(rollbackFor = Exception.class)
public int registMember(MemberRegistDTO dto) throws Exception { ... }

// 특정 Unchecked 예외는 롤백하고 싶지 않을 때
@Transactional(noRollbackFor = IllegalArgumentException.class)
public int registMember(MemberRegistDTO dto) { ... }
```

| 속성 | 의미 |
|---|---|
| `rollbackFor` | 지정한 예외(와 하위 클래스)가 발생하면 롤백 |
| `noRollbackFor` | 지정한 예외가 발생해도 롤백하지 않음 |

### 6. 흔한 함정: 예외를 잡아 버리면

```java
// 예시 코드 3
@Transactional
public void regist(...) {
    try {
        memberRepository.save(member);
        throw new IllegalStateException();
    } catch (Exception e) {
        log.error("실패", e);     // 예외를 삼켜 버림
    }
}   // 정상 종료로 보이기 때문에 commit 된다
```

`@Transactional`은 **프록시가 메서드 밖으로 던져진 예외를 보고** 롤백을 판단한다. 메서드 안에서 예외를 삼키면 프록시에는 정상 종료로 보인다. 이때 롤백을 원하면 예외를 다시 던지거나, 프로그램적으로 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`를 호출해야 한다.

### 정리 표

| 상황 | 결과 |
|---|---|
| Unchecked 예외가 메서드 밖으로 전파 | rollback |
| Checked 예외가 메서드 밖으로 전파 | commit |
| Checked + `rollbackFor = Exception.class` | rollback |
| 메서드 안에서 `catch`로 예외를 삼킴 | commit |

## 결과 (Result)

수치 지표를 얻기보다는 **동작 규칙을 확정**한 학습이었다.

1. `@Transactional`의 기본 롤백 대상은 **RuntimeException과 Error**다. Checked 예외는 커밋된다.
2. 업무상 Checked 예외로도 롤백이 필요하면 `rollbackFor`를 **명시**한다.
3. 롤백 여부는 **메서드 밖으로 던져진 예외**로 결정되므로, 예외를 삼키면 롤백되지 않는다.

팀 규칙으로 정한다면 "Service 메서드의 `@Transactional`에는 `rollbackFor = Exception.class`를 기본으로 단다" 정도가 안전하다. 다만 이는 프로젝트 합의의 문제이므로 판단은 팀에 맡긴다.

## 더 학습하면 좋은 개념

- **Spring AOP 프록시와 `@Transactional`의 동작 원리** — 롤백 판단이 "프록시가 예외를 본다"는 구조에서 나온다. 같은 클래스 안 메서드 호출(self-invocation)에서 트랜잭션이 적용되지 않는 이유도 여기서 이해된다.
- **트랜잭션 전파(Propagation)** — 트랜잭션이 이미 있을 때 새 메서드가 어떻게 참여하는지 다룬다. 다음 글의 주제다.
- **`rollback-only` 마킹과 `UnexpectedRollbackException`** — 내부 메서드에서 예외가 나고 외부가 이를 잡았을 때 벌어지는 상황이다.
- **커스텀 예외 설계 (비즈니스 예외를 Checked로 할지 Unchecked로 할지)** — 롤백 정책과 직결되는 설계 판단이다.
- **격리 수준(Isolation)** — 롤백과 함께 트랜잭션 ACID의 나머지 축을 이해하게 한다.

## 참고 자료

- [Spring Framework 공식 문서 - Rolling Back a Declarative Transaction](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)
- [Spring Framework 공식 문서 - Using `@Transactional`](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
- [Java Language Specification - Exceptions](https://docs.oracle.com/javase/specs/jls/se21/html/jls-11.html)
- [엔티티 매핑 글]({{ site.baseurl }}/2026/11/03/jpa-entity-mapping-column-enumerated-generatedvalue/)
