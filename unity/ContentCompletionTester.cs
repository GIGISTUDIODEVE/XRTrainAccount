using System;
using System.Collections;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

/// <summary>
/// 테스트용 콘텐츠 완료 API 호출 유틸리티.
/// 관리자/참가자/시나리오 정보를 입력한 뒤 Context Menu 또는 Start에서 호출해
/// 서버로 콘텐츠 완료 이벤트를 전송할 수 있습니다.
/// </summary>
public class ContentCompletionTester : MonoBehaviour
{
    [Header("API 설정")]
    [Tooltip("콘텐츠 완료 API의 전체 URL (예: Cloud Functions/앱 서버의 /contents/complete)")]
    [SerializeField] private string apiUrl = "https://api.example.com/contents/complete";

    [Tooltip("HTTP 메서드 (POST/PUT/PATCH). 대부분 POST를 사용합니다.")]
    [SerializeField] private HttpVerb httpMethod = HttpVerb.POST;

    [Tooltip("필요 시 Bearer 토큰 등 인증 정보를 입력")]
    [SerializeField] private string authorizationToken = string.Empty;

    [Header("Firebase Functions (옵션)")]
    [Tooltip("Firebase HTTPS Callable/HTTP Function을 사용할 때 true로 설정")]
    [SerializeField] private bool useFirebaseFunctionUrl = false;

    [Tooltip("Firebase 프로젝트 ID (예: my-project-id)")]
    [SerializeField] private string firebaseProjectId = string.Empty;

    [Tooltip("Cloud Functions 리전 (예: asia-northeast3, us-central1)")]
    [SerializeField] private string firebaseRegion = "asia-northeast3";

    [Tooltip("배포된 Functions 이름 (예: completeContent)")]
    [SerializeField] private string firebaseFunctionName = "completeContent";

    [Header("Firebase Hosting 리라이트(옵션)")]
    [Tooltip("Firebase Hosting에서 Functions로 리라이트된 엔드포인트를 사용할 때 true로 설정")]
    [SerializeField] private bool useFirebaseHostingRewrite = false;

    [Tooltip("Hosting 도메인 (예: https://your-project.web.app 또는 https://your-project.firebaseapp.com)")]
    [SerializeField] private string firebaseHostingBaseUrl = string.Empty;

    [Tooltip("리라이트 경로 (예: /api/contents/complete). firebase.json의 rewrites와 일치해야 합니다.")]
    [SerializeField] private string firebaseHostingRewritePath = "/api/contents/complete";

    [Header("콘텐츠 기본 정보")]
    [SerializeField] private string adminId = "s4V7nkQgV8RTY0ZDEoc6pKJBoqu1";
    [SerializeField] private string participantUid = "participant-uid";
    [SerializeField] private string scenarioUid = "scenario-uid";
    [SerializeField] private string scenarioTitle = "엘리베이터";
    [SerializeField] private string scenarioDifficulty = "easy";

    [Header("진행 데이터")]
    [Tooltip("시나리오 시작 시각 (미입력 시 UTC Now 사용)")]
    [SerializeField] private string participatedAtIso8601 = string.Empty;

    [Tooltip("시나리오 재시도 횟수")]
    [SerializeField] private int retryCount = 0;

    [Tooltip("시나리오 총 플레이 시간(초)")]
    [SerializeField] private float totalPlayTimeSeconds = 0f;

    [Tooltip("미션별 결과")]
    [SerializeField] private List<MissionAttempt> missionAttempts = new();

    private const int MaxExpectedItems = 3;

    [ContextMenu("Send Test Payload")]
    public void SendTestPayloadFromInspector()
    {
        StartCoroutine(SendTestPayload());
    }

    private void Start()
    {
        // 필요 시 자동 전송. 기본적으로는 Inspector Context Menu로 호출합니다.
        // StartCoroutine(SendTestPayload());
    }

    private IEnumerator SendTestPayload()
    {
        var resolvedUrl = ResolveApiUrl();

        if (string.IsNullOrWhiteSpace(resolvedUrl))
        {
            Debug.LogError("API URL이 비어 있습니다.");
            yield break;
        }

        var payload = BuildPayload();
        var json = JsonUtility.ToJson(payload);
        var bodyRaw = Encoding.UTF8.GetBytes(json);

        var methodString = httpMethod.ToString();

        using var request = new UnityWebRequest(resolvedUrl, methodString);
        request.downloadHandler = new DownloadHandlerBuffer();

        // GET/DELETE는 보통 본문을 허용하지 않으므로 POST/PUT/PATCH일 때만 업로드 핸들러 설정
        if (httpMethod == HttpVerb.POST || httpMethod == HttpVerb.PUT || httpMethod == HttpVerb.PATCH)
        {
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.SetRequestHeader("Content-Type", "application/json");
        }

        if (!string.IsNullOrWhiteSpace(authorizationToken))
        {
            request.SetRequestHeader("Authorization", $"Bearer {authorizationToken}");
        }

        Debug.Log($"[ContentCompletionTester] {methodString} {resolvedUrl}\n{json}");

        if (resolvedUrl.Contains("github.io", StringComparison.OrdinalIgnoreCase) &&
            (httpMethod == HttpVerb.POST || httpMethod == HttpVerb.PUT || httpMethod == HttpVerb.PATCH))
        {
            Debug.LogWarning("GitHub Pages는 동적 POST를 처리하지 않습니다. Cloud Functions/전용 API 엔드포인트로 전송하세요.");
        }

        if (useFirebaseHostingRewrite)
        {
            Debug.LogWarning("Firebase Hosting을 경유할 때는 firebase.json의 rewrites로 Functions에 라우팅하고, CORS 헤더(Access-Control-Allow-Origin 등)를 Functions 응답에 설정해야 합니다.");
        }

        if (resolvedUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            Debug.LogWarning("보안을 위해 https 스킴 사용을 권장합니다 (예: https://region-project.cloudfunctions.net/completeContent).");
        }

        yield return request.SendWebRequest();

        if (request.result != UnityWebRequest.Result.Success)
        {
            var hint = request.responseCode == 405
                ? "(서버가 해당 메서드를 허용하지 않습니다. API가 POST/PUT/PATCH를 지원하는지 확인하거나 httpMethod를 올바르게 설정하세요.)"
                : string.Empty;
            Debug.LogError($"API 호출 실패: {request.responseCode} {request.error} {hint}\n{request.downloadHandler.text}");
            yield break;
        }

        Debug.Log($"API 호출 성공: {request.responseCode}\n응답: {request.downloadHandler.text}");
    }

    private enum HttpVerb
    {
        POST,
        PUT,
        PATCH,
        GET,
        DELETE
    }

    private ContentCompletionPayload BuildPayload()
    {
        var now = DateTime.UtcNow;
        var participatedAt = string.IsNullOrWhiteSpace(participatedAtIso8601)
            ? now
            : DateTime.Parse(participatedAtIso8601);

        var sanitizedAttempts = new List<MissionAttempt>();
        foreach (var attempt in missionAttempts)
        {
            if (attempt == null || string.IsNullOrWhiteSpace(attempt.name)) continue;

            // 예상 질문/답변을 최대 3개로 제한
            var questions = TrimList(attempt.expectedQuestions);
            var answers = TrimList(attempt.expectedAnswers);

            sanitizedAttempts.Add(new MissionAttempt
            {
                name = attempt.name,
                success = attempt.success,
                expectedQuestions = questions,
                expectedAnswers = answers,
                answerTimeSeconds = Mathf.Max(0f, attempt.answerTimeSeconds)
            });
        }

        return new ContentCompletionPayload
        {
            adminId = adminId,
            participantUid = participantUid,
            scenarioUid = scenarioUid,
            scenarioTitle = scenarioTitle,
            scenarioDifficulty = scenarioDifficulty,
            participatedAt = participatedAt.ToString("o"),
            retryCount = Mathf.Max(0, retryCount),
            missionAttempts = sanitizedAttempts,
            totalPlayTime = Mathf.Max(0f, totalPlayTimeSeconds)
        };
    }

    private string ResolveApiUrl()
    {
        if (useFirebaseFunctionUrl)
        {
            if (string.IsNullOrWhiteSpace(firebaseProjectId) || string.IsNullOrWhiteSpace(firebaseFunctionName))
            {
                Debug.LogError("Firebase Functions URL을 사용하려면 프로젝트 ID와 함수 이름을 입력하세요.");
                return string.Empty;
            }

            var region = string.IsNullOrWhiteSpace(firebaseRegion) ? "us-central1" : firebaseRegion.Trim();
            return $"https://{region}-{firebaseProjectId}.cloudfunctions.net/{firebaseFunctionName}";
        }

        if (useFirebaseHostingRewrite)
        {
            if (string.IsNullOrWhiteSpace(firebaseHostingBaseUrl))
            {
                Debug.LogError("Firebase Hosting 리라이트를 사용하려면 Hosting 도메인을 입력하세요.");
                return string.Empty;
            }

            if (string.IsNullOrWhiteSpace(firebaseHostingRewritePath))
            {
                Debug.LogError("Firebase Hosting 리라이트 경로가 비어 있습니다. firebase.json의 rewrites 설정을 확인하세요.");
                return string.Empty;
            }

            var baseUrl = firebaseHostingBaseUrl.TrimEnd('/');
            var path = firebaseHostingRewritePath.StartsWith("/") ? firebaseHostingRewritePath : $"/{firebaseHostingRewritePath}";
            return $"{baseUrl}{path}";
        }

        return apiUrl;
    }

    private static List<string> TrimList(List<string> items)
    {
        if (items == null) return new List<string>();
        var trimmed = new List<string>();
        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item)) continue;
            trimmed.Add(item.Trim());
            if (trimmed.Count >= MaxExpectedItems) break;
        }
        return trimmed;
    }

    [Serializable]
    private class ContentCompletionPayload
    {
        public string adminId;
        public string participantUid;
        public string scenarioUid;
        public string scenarioTitle;
        public string scenarioDifficulty;
        public string participatedAt;
        public int retryCount;
        public List<MissionAttempt> missionAttempts;
        public float totalPlayTime;
    }

    [Serializable]
    public class MissionAttempt
    {
        public string name;
        public bool success;
        public List<string> expectedQuestions = new();
        public List<string> expectedAnswers = new();
        public float answerTimeSeconds;
    }
}
