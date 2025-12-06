import { toast, toastMessage } from './domElements.js';
import { state } from './state.js';

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isStrongPassword(password) {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]';`~\\/]/.test(password);
    return password.length >= 8 && hasUpper && hasLower && hasNumber && hasSpecial;
}

export function formatGender(value) {
    const map = {
        male: '남성',
        female: '여성',
        other: '기타/응답 안함'
    };

    return map[value] || '-';
}

export function formatStatus(value) {
    const map = {
        active: '활동 중',
        paused: '일시 중단',
        completed: '참여 완료'
    };

    return map[value] || '-';
}

export function formatDifficulty(value) {
    switch (value) {
        case 'medium':
            return '보통';
        case 'hard':
            return '어려움';
        case 'easy':
        default:
            return '쉬움';
    }
}

export function formatDurationSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '-';
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}시간 ${minutes.toString().padStart(2, '0')}분 ${remainingSeconds
            .toString()
            .padStart(2, '0')}초`;
    }

    return `${minutes}분 ${remainingSeconds.toString().padStart(2, '0')}초`;
}

export function normalizeConditions(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

export function formatConditions(value) {
    const list = normalizeConditions(value);
    return list.length ? list.join(', ') : '-';
}

export function calculateAgeFromBirthDate(birthDateString) {
    if (!birthDateString) return null;
    const birthDate = new Date(birthDateString);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayPassed =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!birthdayPassed) {
        age -= 1;
    }

    return age;
}

export function formatBirthAndAge(birthDate, age) {
    const birth = birthDate || '-';
    const ageText = Number.isFinite(age) ? `${age}세` : '-';
    return `${birth} / ${ageText}`;
}

export function formatDate(date) {
    if (!date) return '-';
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    return parsed.toLocaleDateString('ko-KR', options);
}

export function formatDateTime(value) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR');
}

export function formatDateTimeLocal(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

export function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = 'toast';

    if (type === 'success' || type === 'error' || type === 'warning') {
        toast.classList.add(type);
    }

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

export function getAuthErrorMessage(error) {
    const code = error?.code || '';
    const messages = {
        'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
        'auth/invalid-email': '올바른 이메일 주소를 입력해주세요.',
        'auth/user-not-found': '등록되지 않은 이메일입니다.',
        'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
        'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
        'auth/too-many-requests': '시도 횟수가 많습니다. 잠시 후 다시 시도해주세요.',
        'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
        'auth/cancelled-popup-request': '다른 로그인 시도가 진행 중입니다. 잠시 후 다시 시도해주세요.',
        'auth/popup-blocked': '브라우저에서 팝업이 차단되었습니다. 팝업을 허용하거나 새 창에서 다시 시도해주세요.',
        'auth/operation-not-supported-in-this-environment':
            '현재 브라우저에서 팝업 로그인을 지원하지 않습니다. 다른 로그인 방법을 시도해주세요.',
        'auth/unauthorized-domain':
            '현재 도메인이 Firebase 인증에 허용되지 않았습니다. Firebase 콘솔의 인증 → 설정 → 허용된 도메인에 이 도메인을 추가해주세요.',
        'permission-denied': '데이터베이스 권한이 없습니다. Firestore 보안 규칙에서 읽기/쓰기 권한을 확인해주세요.'
    };

    return messages[code] || '인증 처리 중 오류가 발생했습니다.';
}

export function getFirestoreErrorMessage(error) {
    const code = error?.code || '';
    const messages = {
        'permission-denied':
            '데이터베이스 권한이 없어 프로필을 불러오지 못했습니다. Firestore 보안 규칙에 현재 도메인/사용자가 접근 가능하도록 설정해주세요.'
    };

    return messages[code] || '프로필 정보를 불러오는 중 문제가 발생했습니다.';
}

export function buildFallbackProfile(user) {
    return {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || user.email?.split('@')[0] || '사용자',
        username: user.email?.split('@')[0] || 'user',
        affiliation: '',
        position: '',
        birthDate: '',
        age: null,
        gender: '',
        region: '',
        conditions: [],
        status: 'active',
        notes: '',
        createdAt: user.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date()
    };
}

export function isFirestorePermissionError(error) {
    return error?.code === 'permission-denied';
}

export function resetAuthForms(loginForm, signupForm) {
    loginForm?.reset();
    signupForm?.reset();
    state.conditionList = [];
    state.participantConditionList = [];
}
