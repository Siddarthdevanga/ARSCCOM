'use client';
import { useEffect } from 'react';
import './landing-page.css';

const BODY_HTML = `

<a href="https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Hai Visitor+-+Visitor+Management+Platform" target="_blank" rel="noopener noreferrer" class="floatingWhatsapp" aria-label="Chat with us on WhatsApp" id="floatingWa">
  <span class="waPulse" aria-hidden="true"></span>
  <span class="waPulse waPulse2" aria-hidden="true"></span>
  <span class="waIconWrap"><img class="waIcon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASAAAAEaCAYAAACxYopLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAADv2SURBVHhe7d15mFxVgffx77m3qrrW3ruT7vSWhCQkgYSw7/uiICgoOiCgouKgjg4u4zqKvDNu4z6OC6LogCK7gIAiOyEQCISEhIRsHdKd3rfq2usu5/2ju5nMHYSk+9ba5/M8PDzPOZVOp+rW7557VrHg6tOk+PB8FEVR8k0TV3Q4yxRFUfJCwyucZYqiKHmhOQsURVHyRQWQoigFowJIUZSCUQGkKErBqABSFKVgVAApilIwKoAURSkYFUCKohSMCiBFUQpGBZCiKAWjAkhRlIJRAaQoSsGoAFIUpWBUACmKUjAqgBRFKRgVQIqiFIwKIEVRCkYFkKIoBaMCSFGUglEBpChKwagAUhSlYFQAKYpSMCqAFEUpGBVAiqIUjAogRVEKRgWQoigFowJIUZSCUQGkKErBqABSFKVgVAApilIwKoAURSkYFUCKohSMCiBFUQpGBZCiKAWjAkhRlIJRAaQoSsGoAFIUpWDEwnVXSmehogCY0kYisZDYSIx9rpQ41r4vfV0YHQAB+IRAADoCEHiEut8p/5sKoFnKlhOhYiPREPg1L2EtgC08aLqPFi1Aq6eWGj1Ek6eakB4krAeo8UQAqNdDzh9JRlrE7DQpO03azjJuJenKDhGzkvRZUfZYMUatNB5pkbFSZKVBQhroCHQEGgIhhPPHKmVMBdAsYcqJFoucbJ00e2pYGmhnQcVclgZaqdPD1OohQrqfiB7EKzwIBJoQTLRjQEOg7UcrxpYSJsNNIpESbGwAYlaKlJ1h1IwxbqfoNqJsTnbSmelmc7qHhMxMBBEgEOj78fcppUsFUJmRUmJPhoxH6PiEh0ZPJa2+eto9dZwYOYRV4UVE9IDzjxacIU26MgOsjW/jheQ2uoxh+owx4nYGQ5oY0kYAmmollQ0VQGXCkjYmNn7hZUlFEwf5mjgs0MHSYAe1ngj13kr8wldSjzjDxjijZoweY5gXEjt5JdPF1nQ3A+b46wGrlDYVQCXMlhIhwCd81HireWfkMI4LLaWlop453pqye3xJWRn2pPvYmu7m8fhGHk3txLbSGNJCV/1HJUkFUAkypcWYtDjO38Y7qo5mVXABHf65hDQ/FZrX+fKyY0mbjG0wZEbZkell9fgmbos+w6idpVp4VBCVEBVAJcCWEk0IdDQiepATgov4QP3ZLAu2OV86a0WtJPeNPMtt0TX0ZofJSANzss9IBVLxUgFUxKSUmNg0eCpZFejgrMhhHBqcz3x/k/OlyqSElWZDYidPxjaxNrWDbZkebGmX3eNouVABVISknBgs13Uf74kcwduqj2JlcMGseLxy04gZ4+nxTdw29hQbUl1Yk1MRVIuoeKgAKiJSSsakyYqKuVxUfRynRVbQ7KsjqPudL1UOwIAxxsuJnTw4/hJ3xtbhl6gWUZFQAVQEpJRIwNR9fKrmdK5sOIegXuF8mTJDlrTpyg7whe7f8nK6GyEnJkeqFlHhqAAqICkn1lktq5jH+dXHcFblYTT76tVEuxwzpMXLyU7+OPwkj8Q3kLSzqkVUICqACmCqxRPWA1xcdRxXzTmXKj3ofJmSY6a0WD3+Mr8dfpjnU7uRatQs71QA5ZklbQKaj4urjuf8mmNY5J+nOpcLbMiI8lh0A/eMP8u6ZKdatZ9HKoDyZGJIXdLqq+PbzVewMrQAr/A4X6YU0LAxzq8HHuCXo0/gVzOr80IFUB6Y0qZWD/K+ujO4tOYEGrxVzpcoRcKWkhcTO7h+6C88GX9lcgcAFUS5ogIoh6b6eo4NLeJrzZfQUTHX+RKliP22/6/cOPoo/WYUHU21iHJABVCOGNKi3VvPB2pP423VR1HnrXS+pCRZk0PXKTvrrEIXGj7hKZuNxUxpsSnZyR+Gn+Th+Aay0nS+RJkhFUAuk1KSxubk0BK+Pvd9dASanS8pSraUWNjY0sbGZtiI0ZMZYMROMmKMk7DTRM0ECSsJQFRO/H9fuvASxotHeAh7QlTpASr1EPWeCHN9dTR4qwloPrTJjca0EmlVmNLij0OP8bX+OwmUSbgWCxVALrKlxCc8XF53Oh+qO53aIm/1jJlxdqV72ZbeS7cxTK8xSp8xwrAVJ2MbZKVBWpoTq8+lgYmc3PF5/3iFBx0Nv/Dg17wINOo9Eao9YZr0app9dbRXNHKwv6Xo17cZ0mRT8jW+23cna1M7CaoBBFeoAHJRtRbim/Mu5+TKQ51VRcGQFqNmjHtG1vCH0Sd5zuinGg8hMbEJqiePLZKphbYGNlFpUSs8vCtyBOfXHMdR4SUENJ/zjxSFqBnnGz238MD4i2q43gUqgFwhOC64iE83XsDyYEfevsRvxpI2Y1acvuwIG5O7WZ/azcbULnZk+7GlxC88RTW6I6Uki00CmxYtxMGBNg72t3BMYAEHB9up81TiL5JQytoGtw4/yc+GHmDUSqogmgEVQDOUkgZXVp/Cp5suIlwE+yxb0mZXppfnY6/yt9gLPJh4lUp0fFrpPTJY0iaDRb0e5j2VR3NS5UpWhQ7CXyQTN19K7ORLPTfRlR10Vin7SQXQDAQ1P59ueAfvrDm2oOEjpaQz08v65E4eHt/I9sxees1o2eyDM9VBHtYqWOBtZFVwASeGl7IydBBVnrDz5XkjpeTVVBff6r+D5xLby+K9zjcVQNMwdWe+ofXjnF51mLM6r3qzI3xj782sS+1ixE4SFMXROsglS9rYk4t4L609lYvrTnK+JK8MafLlrt9x7/jzeNVG+QdEBdABsqRNu6+Rf2u+jCPDi5zVOWdLSdxK8mRsMzeOPsFLyR14mNiutZj6dPLBkjYxLNo91ZwZWcnF1cezONCCrwCPaCNmjOsH/8Jto6vVfKEDoALoAJjS4lB/K19tupQVBehsztgGz8Q2872Be3g104cHgaZWb0/uIAloOlfVnsFFtScwz1u3X4cousmwTX43+BDfGvwTgVnQEnWDCqD9ZEmbU8OH8C9zL8r7nJVxK8kj0Re5N7qOl5K7SElDjby8gam+og7fHE4PL+f86ondBrx57IDP2AZ3jDzFfw49QNxKOasVBxVA+8GUFqv8bfyo7WoavdV5a3HY0ubp2Cv8ZugvPJPciT55RHK+/v5SNbXRW1j3887Q4VzddAH1eVwAbEqLu0fW8IXem2ZFn9xMqAB6C6a0OCq0iB+3fozaPI242NJmQ3IXvxt+gqfiG9WOfdNky4nz6dt9jRNr8qoOp8YTyUuAG9Lk7pE1fLf/btLy/66bUyaoAHoTlrQ5zN/Kf3V8iho9lJcLN2GnuWnwEb4/+Ge8CLVDnwvkZBC1VTTy3eYPsDK0wPmSnJBScufIav5FtYT+Lr32qlXXOguViZbP6ZFD+XbLlTR4q3IeAkkrw9PxzXyz51Z+E32ayOQJn7n+e2cDISb29Bk14zwa28CYGWeer5bqHLdohRAsCsyjRa/mhfQuNTr2BlQAvQFL2hzqb+W6eZfR7KvLeQgkrDQ/77+PHw3+mc7sIEE1lyQnNCFI2wYvpTt5KbGdZk8t83J8CIAuNA4OtBESPu6NvURAfbb/iwogB0vatHrr+bd5l7Mk0JrT8LGlZF1yB9f13MK9sRewpJXTv0/5n8fZPjPKmsRW0naGg/zNBLTcHYOkCcFBFU0EbMkL6d0gpfqcJ6k+IAdDWtzc8RmODC3K6UViSptbh5/gWwN3IW11YmchTPUNza2Yy83tn2Cer975EldlbIP/6L2Dm0efVNMoJqkW0D6Cmp+ft/4jx0aW5jQMujKDfL/3Ln41/BBSSjTV11MQU31D42aMR8c30uSposlbl7N5Qx6hc0iwg1dSu9mTHc7po1+pUAE0KSUNvjTn3ZxXc7SzylWbkrv5yt7f8mRyi+pkLhKaEIxbKR6Jb0KTFkeHD3a+xDUBrYITw8t5MbmdfiM66z9/1Q4EQHBl9Sm8s+ZYZ4VrbCn529gLfK77RjakuyYH2JVioQmBaRvcMPwIn91zPQPGmPMlrqn3VvKluRdTrYde32N7tlIBBBObieVwPx9TWtw5upov99xMV3ZQrZguUkIIDGnyYOwlvtL9WwZzGELLgx18de57CGn+/1nLNgvN6gCypSSs+fl04wU5C5+YmeCmwUf4eu9tpGR21je5i50QAg3Bk4mtXNb5AzYkOp0vcYVH6Ly95hgurzllVl8TszaA5OQG8t+edwWHhOY7q10RNRN8r+cOvjd4L0JOjHQppcErdPZkh/hyz3/zUmKns9o1H2w4i8P97Riz9PqYtQGUxubyutM5tXKls8oVMTPBT/vu4dbYWgRq3kcp0oVgR6aXf9n7W1aPb3ZWu6LKE+I7rR+hw9eIPQsfxWZlABnS4qhABx+qO91Z5YrYZMvnj9E16LPvmiorXqHTnR3mKz038VzsVWe1K5p8tVzTeD6Gs2IWmHUBJKWk3VvPt5uvyMm5XVEzwU/67uGu2PNI1fIpC5oQDJhRPrP3Bp6O5aYldGrlSi6pPg723WBtFph1AeQROh+uOzMnJ5bGzAQ/6LmDm6KrsWf58Gq50YXGiJngut5bc9In5Nd8XDP3Qo4NLnZWlbVZFUCmtDkptIS31RzlrJoxW0r+MPwEt8fW4lHH95YlTQh2Zwf4Ys9/syW1x1k9YzWeMFfUnTarhuZnTQBJKQlrFXyu6T1U6SFn9YzYUvLAyDP8eOhBxOy4bmYtr9B5LTPAt/tuJ2olndUzdmx4KedUHobF7LiQZk0AmZOjXh0Vc51VM/ZI9EW+0X87GrZq+cwCutB4NrGda177BSNmzFk9Iz7Nyxeb30uTt3pWjIrNigCypM0cTzVX1J3mrJqxTcndfH/gXpJ2xlmllDGv0Hk2uYMf9d3jrJqxkObnUw3nI2fBvazsA0hKSVgPcF3TJVTp7u6A15UZ5Lqe39OZ7Vctn1lIAPdE13Lz4KMYLu92eHrlCo4JLiRb5hMUyz6AbOC8yOGcWHmI69sf/HLgQTZnegq+tktKSVZaRG2DQTuDKS0S9mycVZJfE2vHLH4ydD/PxrY6q2ekUg/xuTnvplGPlHWHdFkHkJSSOj3EeVVH4nExJKSU3DDwV+6OPluQNe1SytdXUUvNR1vFHC6vPpGfzfsQTx30dR5adB3fb74cn+bDKuOLtxhoQpCwUvx44F7GTfc6pYUQHBLs4F3Vx4LLN85iUtY7IprS5sM1p/LppotcPa53XWI7H9r9n1jSdL1V9Wbk5MF7PuHh5PBy3l1zAu2+epp99XiEjrbP8cxSSraku7i08/sYtqEeEXPMlBarQou5sf2T+DWfs3radqV7+die/6LXGHVWlYWybQFJKVnga+CShjNcDZ+4leIn/fdg5zF8pJRIIKgHeHflMfxx/uf5afvVnFa5ggX+ZvyabyKA9vl9hBAsC7RxXuVRs2RAt7A8QufFxDbuGX3GWTUjrRWNvKfyWExpl+WjWPkGEPDumhNpcXGf36SV4TcDf+HFVG62aPh7skguqT6BX7d/kq+1vJ9lwXbnS/6u86uOJKMiKC88aNw4/Ajd2SFn1bR5hc7F9aewtKK5LD/FsgwgKSWm7uOcylXOqhl5Nr6Fm8eegjxtIG9Km2o9zM9aPsznmt7DiuB8Kg6weX9IsJ1zQsswy3w0pRgIIXgtO8gPeu9g1Iw7q6et1hPhfbXluW9QWQbQmDT5VM3pNLvY+olZKX419FfiVtpZlRMpaXJ0cCG/avsEZ1QdMe1+hZDm5wMNZ1GpBcqyCV9sdKHxcHwz948956yakdMrV+DVg87ikld2ASSl5FDfHD7UcLZrfTS2tPn90KM8kdrp2s98KxdEVnF9x6dYGmyb0d8phOCY8MGcFF7mrFJyxJQWvxt9gn4Xt3Rt9FbzD5EjSLs836jQyi6AbOC8qqNdPWhuQ3IX3x/8M7V5ON/blBbvrDyaf533/mm3et7I2ypXTU6dU3JNE4I9mX5+0ns3GRfnY32o8RxavHVltUSjrAJISkmVHuTc6sNn1Gpw+u/hJ/Dm4ctrSJszIiv5Rstl1HoizuoZWRlcSIevAVNtE5IXXqHz4+hTPBd3bxOzOd4a/qH6RFev7UIrqwBKS4vzwitp9jU4q6ZtbWwLT8c35Tx+Js6jb+Hzcy90ddLklAZvNR+szc0OkMob69AC3DjyqLN4Rk6JHILXxdZ9oZVNAEkpqfcEOb3qcAIuPboMGmN8r+8uYnY6pyMQUkqk0Plq0z/kZLU+k31BF9efTLu3XnVG59ELie08Ovaia+95a0UDZ4QOLptRzbIJICEExwaXcFzEvc7W1bFNvJzpRs/xOd5CCD5d/zYOCy10VrnuivqzZs1eM8UgKy1+NHgffcaIs2pawnqAd1QdUzabluX2m5VHOhpnRFa49nycsQ3uja5Dz/HDl5SS+b5G3lF9jLMqJ86OHArCUxYXbynQhWBTZi9r4+4tVj02spQV/payuI2UTQBV6yEODbpzvpctJc/ENvNScpezynUSuKjqGJp9dc6qnKj1VvGpurNJUx5N+FJQgc594+tcm0Pm13ycGlmJJ8ct83wo/X/B5ND1ocF25vubnFXTErMSfG/gHlIyt4s4pZR4hc6FtSfn/DFvii40Lqg5loWqLyhvdKHxbPxV1se3u/aeHx1aTKVW+hMT83PV59iYtPh4/XnO4mn7S3Q9WzO9Ob/DWEgurDmeak9+L6SWigbeVX1cWW/zUGxsJF/v+yNRK+GsmpaF/mYW+5tf35alVOX2G5YHtpQc529jWbDNWTVtd40/jzcPb4022W9VCOdVHUl9mW92VUx0obEl289z8a2uvOc+zctF1ccRK/GZ0bn/luWagHOrjnaWTtvOdA8bkzvz8sZ4PQEW+BqdxXnR5Kvn3MhhZdGRWSrqtAruiK7FdKn/7bTKldTrYVcCrVDy8T3LqQrh44jgAmfxtNhS8h+9d2BLK6d9P0z2/yz01FDvrXFW5YVP8/CeupOp0UMlfQGXmrXxra51Rod0P++pOhqzhG8jJR1AlrSp8VbT4Xdn8t7OzF7WpXah5+FtMbBZ5W9Hz3HQvZmF/maOCS0u4cu39KSkwW8G/uIsnrbjI8vwCY+zuGTk/puWQyY2l4SPIKIHnFXT8kJiByN20rW5RG8mJW0OCy5EK/BH8N6aE1VndB75hM4fx1bTm3VnYuLB/haqPJXO4pJR2Kt/BqSU+IWX5aEFeF24A1jS5onYZoJ5WPEOkMWmzdeQl7B7M4eFFnJcaLFapJpHcTvD+sQOVx59q/QQB/saSnY0rGQDyAaWVDS59vi1K9PL9sxeZ3HORIROjbfwdy6/5uOLc99NqkzWFpUCG8naxDYsZh4aFZqXM8IriZfo51eyASSAxRUtrswgtqTN+sROes2osyonpJREimhFc7tvLu+oXFVW+8wUM6/QeSG1izEXtm31CJ1lgTbq9NLc8bJkA8gjdFb4W53F0zJmxblt5AnsPDVjJRDRAjnZdmM6fJqHsyMrZsVRwMWiOzvIC4ntzuJpmeOrYWlFE3YJDieUbAD5hIelwQ5n8bQMZMdYl+7K23IIAcTtdN4Cb38cF1nOSn+bagXlSVoabEx2unKk81xfLUsrWgvenzgd+fnG5UCjp9K1XQM3JDvx5XjV+76EEGSlWVR3rAZPFe+uOj6P78LsJhA8HN/IsBlzVk3LEv88fMx8MCbfSjKATGnR5qunwVvlrJqWtald+LT8fnhDdhbDxf2CZ0oIQZ23krDud1YpOaALjVcyfbyW7nel72ZpsANvnq9hN5RkAAEs8TW5smm7IS12pLucxTmXwWbMcu8scTdEzThRK+UsVnIkOHma6sS5tzNT6wlTrYecxUWvJANIAkeEFjuLp2XUjLElj8PvU6rQ2ZJ8rWjmb6xP7OC3I4+pR7A88gqd9ZkuVx7Fq/UQ7b76kuvDK8kAspGsCi9yFk/LPSNrCvKh+YXGtsxeVy6+mdqZ7uHrPb9ne6Y3bx3xyoQ9mX5SdtZZfMBCmp8mvRrbhblF+VRyV5stJXP0SteWX9wTXYvfhZnUB0ogeNXoRxa4BfRKag/XdP2KbZm+khxFKXWd2UHidsZZfMCEECzyNzuLi17pBRCSZQF35v/ErSSPZ7oK8sXThcYWY5iE7c7K6OnYnenj63tvYkemP+ebrylvLIHF2tgWZ/G0zK9oKrkDB0ruqjOQLA64M//n5cRuqijcZEDNytJvjDqL8+KV1B4+3/VrNqW7CxLAyoQwOn+NPu8snpbDw4tKLH5KMIB8aCz3z3MWT0uvMUyogHf+jJ1hj0vHtRyInekevth9I5vTe1WfT4HpCB5JvOIsnpagVkGjXlmQPs3pKrmrr0LzuDLcaEvJzuxAQbfDsJE861Lze3+tT+xQfT5FRAhBv8yyJ9PvrJqWQ/2tRTGwsb8K9+2bpqCooNaF0wAsLLqNoYL2fegInonnL4B2pnu4tucW1edTZGrxsCvT5yyelhZvgwqgnNJ8RDxutIBsBowxZ3FeaULQa46yLbnHWeW6jclOPtt1A69melTLp8joQtCdGXIWT8uSUAeGCqDcEbqPsAtD8DaSaBHMRE5Lkwej65zFrurKDPLvvX9ke6ZPtXyKkI6gxxx1pe9mrqcKTwlNJy2pq9GWkvlayJU9cIeNGJkiWIslgI2p3Yy6tCjRKW1nuXHwIdaldud8o31legSCMTOB6cKmYpW6P2+7erqhtAIImxpPGOFCwvdkBkjLmc9AnSldaGzK9NCbo+H4rswA10efxl/A6QbKm/MIjQFz1JWtOYLCS7CINrt7KyUVQBJo0qtc6cMYsuKkXfjA3ZC006wZ3+QsdsWWdBchKVXrp8iN2ylXllH4NZ8ri7TzpaQCyEJS44lMPrjMzIgZK5qFoJa0eSK+mbEcPIbF7awL75aSawkr48r16BVeNBe6KPKlpALIRtLoqUJz4SsVt1Jki6QFpAnB86ldbEzscqUjcl/FtPe08vdlXNqgrkLz4lEtoNwwJIR1vyt9QEmZJevSEbluuXHkEdIuLEzc1xJ/iyvHFim5lZEGaRdWxXvRS+qct5IKIIBKPTzjPiApJWkrVVTDlR6h8VK6m+6sO/NBprRXzOHS6uOxpHRl5z0lNzQEGRcCyKPp6CV0wym5AHKDiUXM5ZaGG9JWmrtGn3EWz0iF5uXKxre5tn5OyQ1LWq60gHS0orqxvpWSCqA4FvUurAPL2CYZWXwBpAvBb0cepc+lY3unzPHWcH7VMS70MCi5YkiLEWvm54QBVKp5QMp02Ui+1vN7V+aE7OvC2uM5IbTIlZEWpbgF1SOYMl0+ofNSspONiU5n1YxU6kH+tfn91HuqVF+QUjRUABWhhJ3hoegLzuIZa6to5IN1Z5TcrnlK+VIBVJQkj8Q38koOVslfXHsCKwNtGC6sO1KUmSqpAPKjMe7CHsq60NCLuKNOCEG3McrPBu8nZiac1TNSqQf5YetVHBJoV49iRUQXGmHNnUMhh4twgOXvKakA8iBcuXP7hIcwxRtATM4L+lt8E8/HtzmrZqzZV8c/1b+dSj2gQqhIaAgqXLgpSiBbQgMNJRVAAIY0Z7xcQUPgKYGRAo+U/HL4L67MD3E6PrKcf2p4B17hUSFUBIQQBF04FtuSFqYLi1rzpaQCSAAxKzmZ89MnhCDswq6KuSaE4LlkJ7cPP+l6SPg0L5fWn8a7qo8tsgUps5NXeFzZaC8jTbK2u1M4cqmkAsgnBCNGzJVFe1V6oCTWSAWEh18O/43Xsu5sWu708cZzWRFoxSyhZns58qK7Mn/ZkjZeF74f+VJSASSAXnMU6cIbXKmH8Ini36RLE4KoFedPo89i5yAkGr3V/Lzt4yyqmDvjR1tl+iJ6AN2F6zEts64vaM6lkgogHUHMSuLG96ROD+EpkV0CbSm5a2wNa+OvOqtcUeet4pvNV3CQb44r24IqB86veV3ZZsaws9jqESxXBF3msCs7x9X5aktmg3YhBH3mOD/suytnJ6keGprPt1s+QLuvUbWECqDOU4nHhRZQ3M6SdGGqSr6UxjdwkkdodFtJV9YztfrqS2rvXJ/Q2Zjp5t7RZ51VrlkW7OC6pkuxtZkPByv7z5Q2NXrYlQBK2BnSsvCHLeyvkgoggITMurJvik/zEnBp4le+6AiuH3qI7aku10fFphwTOZifzfsgPuErWEto6t8mZ8keRhJJpR5wJYCS0iChAih3NCtL1Jr57GAdjSZvtbO4qAkhGLfTXNl1Pb05PFP+9KpVXN92NQf55rjS2jwQprSp1cMcGzyIY4OLaNAjmNIu6yCykMz3NjqLp2Vbeq8re6bnS8kFUNrOMO7CgYK6EMzRS29luFdojGSH+fXQ33IyKjblyPBivtfyIRb4GvLSEpJSYkmbBk+EH7Z+lBvmX8OvF1zDLzo+wfurT8Cv+co2iBLSYqFLG8btTPXgVQGUOxlpuHKiqYZGs6+upGaN7uvesbXcP/JMTsNhcbCNb8/7IKsCHTk/wshGsiLQzvVtn+TI8KLXyw8OtPG55vfyp4Vf5pqG82nx1ZGWZlkFUQqbhf4mZ/G07MrsdWlGUX6UXAAlpckuY9hZfMCEELRXNGKUYAAJIUjJLN8Z/BOvpF5zVrvq0NACfj3/nzkuuJi0tFz/4kspMaXNPG8t/958OUuDbc6XENB8tFY08rE553Lnwq/wmfrzGBG8vs+1279TPlnSZoW3npALyzBsKdma6UEvkdFdSjGAdGBrqstZPC2LKprIlvDFO2zG+U7f7Tkbmp/i13z8qPWj/GPdOQQ0n6tfeAvJMn8Lv2j7OAcF3voxJKz7+fjcC9i85Dt8cc5FHB5cgEfoJTuT20Rydnils3haujL9ZEpsYU0JBpBgW8qdfXIOCrQgEa5+ofJJFxqrE9v55t5bGDPd2U/476nzVvK5pgu5rukS5niqMGfYGprq82nx1vLdeR/cr/DZV60nwgcazuSmBZ/jB/M+yPGBBZiUXosog82FtSc5i6dli0s35nzSa69ada2zsJgJYNRO8PHGc51V09KV2sP2bD9aCTVb9+UTOjuMAbJWlpMqD3FWu26Bv4kVgXYGzSid2YFpN/en+nx+2PKRAw4fpwX+Zk6ILOfwwHwkkkFznKSdnfHxTfkwR4/wj43nunKc8v3R53gxubOkruXS+U0nCSFIS4Nd6R5n1bRcUnc64yXYD7QvHcHvRh/jtqEnnFWu04XOEeHF/KDlI1xceQx7pzHr1pQ29Z4I1zZdOuPwmVLvrebMqsP5TuuV3ND2SU4OLmbMzua0k94NTb56gi6EjyFNdmUHnMVFr+QCCEBDsCa+1Vk8LStDB1GvzXwbhELT0fjWwF3cl8OZ0vuKeIJ8reUybmv7BAt9TRj7+UhmSZvl/haub/vkG3Y4z5RX6CwPdfDTjn/ito5rOKVyFSHhw5J23uc0vRVL2iysaHZlAuK4maQnO+zKz8qnkgwgAWxz6XnXr3k5LNDhLC45mhAY0uTavltZG9virM4Jn+blrKrDuWfRV7mk6njst3jkMaVNnSfCt+ZdkZPw2ZdP83B8ZBk/b/so9y+6lsuqTyCs+V3ZUdMtGSxODi5y5ajxhJWkxxxzFhe9kusDYnI7Mo+mc0blSgIurOfake6dfHae+YVQaFnb4Mn4JhZ6G+hwaW7J/jg+spzDAx0k7DSvZYcxpPn6F8vCxis8nBReyrfnXcHiQKvzj+dUUPdzcuUKTg0vo0oLMmCOM24lsJEF+8xtKfELL1c3nkutpxIxw99jQ7KT+6PrsEqsO6EkA0gTgoxt8rbKVdR6K53VB8y0s9w5vhZviTVf34gmBBlp8nRiC2dVrqTKE3a+JCd0odFeMYczKw/j4IomLNug3xzHRnJMcAGfmXMhH244hyZfnfOP5k2dt4rjIks5p3IVzZ5qOrN9DJqxgnzuFjYnhpZwYc0J+PWZ9wH9efQ5nktud2GnrPwSC9ddWWq/MwAedH7c+mFOqZz5HIq92SEu3Pkt4laqYHdEtxnSptlbzQ9aPsJhwQUzvsMeqLiVJisNJBKv8FCpB50vKShTWoyaMR6LvcwvBv9KjzGc1+1ZLCRfaryIy+rPmPE1l7YNPt91Aw/HNk57VLJQSuu33YeFzYuJnc7iaanzVHJx5dEl13x9M16hMWBE+XTX9WxIunvK6v4I635qPRHqPJVFFz4AHqFT76ni4poT+UHLh1wZBj8QjXqEo0KLZxw+AP3GCDvSPa70JeVbyQaQKW1eyXSTsma+/aRf83FK1WFUlcFo2L6EEAya43xyz8/529i6nC5eLUVCCIQQLA200e5vzusoWZuvgfaKOc7iA2ZLSWe6j53GoCthlm8lG0AC2JruZk+6z1k1LSuCC2j11juLS54uNEatBF/pvYXHxzc6q5XJ96hZD7uy1/j+MKTFyaFlrrS6TGnyQmJbCbZ9JpRsAGlCMGCOsyPT48qdy695OTy4wJWfVWyEmNhL+196fscdw0+V5b9xJixps9Mcy9scmoDwcmRokSstlrQ0WJ3aXpCOdDeUbAAx2Qr60/hzpFw6BeDE8FJXjvwpRrrQSFkZ/r3/dq4feMBZPasl7TRjVspZnBOWtGn31rEytNBZNS2vpfvpyg45i0tGSQeQR+hsSve4thDz0NBC5vvqi376/nSJyekLPxz8M1/rvom9JXzhumnAGMNyYZfN/WEi+ezcd7u2XuuF5A7ieQrPXHDnXSigmJVgs0t74tR6IlxZezbj5HbzrULShMAndG4dW8MXun7N7nTffi2hKGd9ZpSEdeBr2qZjgW8uR4UXO4un7e7RNa4c51MoJR9AprR4xqV1YQAX1Z1Ih6em7L+UXqHxXKqTT3X9ihcSO3Jy/nypuGf0GWdRTpjS5qTwMiqEO6eObE918WJmryt9SYVS8gGkI7grupa07c5JAB6hTZ6XXt4BxORWHjszvXxsz39xy9BjGDnedrUYjVspnk68kpdtTLNYXFJzvGvzdW4beYqgS49yhVLav/1kv0bcznDHsHtbUZwdWYnt0kVS7IQQZKTB9wfv5fPd/82W1J6y7QNzsqXknpGniVmZnM8UN6XFFVUnMa9ijit/15AR5fnUrpId/ZpS8gEEEBAe7oyude1M7MWBFi6vPLaoVk7nmpSSv0Sf5/2dP+ThsXVkXGpRFrMxK87DsQ15udU0eqq4rP40/C4d+vhSspPdmdLb/8epLAJICEF3dpiNyd3Oqmnxaz7e33A682ZBX9AUIQQeoZG2M3xq72/4t723sC3VVdZnxa+Lb+OVdLcrLZI3Y0qb08KHclCgxVk1LbaUrIlvduWI8kIriwACyMgsq2ObncXT1u5v5qTw8lnRF7QvbTKI7hxfyz91/Yq7R9aQLcPW0LAR5Y7R1SRcajW/GYHg7VVHOIunrTs7xLOJV0t2I/59lU0AmdLm6cQWoqY78zl0oXFh9bGEdP+s6RPZlwbsNYb5t77b+OeuX7E+sZOsXR6d1Ia0uG/0OZ5MbMn5CJIlbS6oPJyVwQXOqmmxpM3D0Rcn9zHP7e+eD2UTQALYkunhgdHnXAuM5cEO3l99Ul76CIqVKS0ej23iytf+k890Xc+edK/zJSVna6qLX448hJ6Hy7/eE+GLze8joM984zyAEXOcO6LP4qW0O5+n5P4TyBMhBFLa3BVdw7A57qyeFq/m4aONb6fF1zBr+oKchBCT270a/C22kXd1fo/fDj5MT3a4JNeUjZgxvtD9O0bNeM77frLS4u3Vx1LjiTirpm1dfBvd2aGyaP1QTgHE5GPTlkyfawcXAkT0AB+oPa1s14gdCK/QyVgp/mPgbq5+bWKLj1ieZhC7YcSM8cXuG9mR7c355mOWtKnSg3y49lRn1bSZ0uaR2Mtky2i+VkluyfpmpLQxpMmZlatcu0vM89bySOIVRsxx135mqRJiYhrdsBnj0fjLbEm9ho5GjR4m6MLxwrkyasb5Yd+feCi2IefhI6XEr/n4j+YrODTkTt8PwMbETr7Zf2fOf/98Kp9/yT7uH1/PxuQuZ/G01Xgi/KD5CiqEd9Y+ijlpQmBh82R8C1/eezMf3P0j7hxZ7XxZUZh47LqRu6LPQp4+v2NCSzipcoWzeNqytskX+m8ru/7IsmsBTTzXS55PdXJxzfGu7PEihKDBW03SSrEh7c5co3IhhMDGZtSMc8f4izw6/iJedGo9EXzC48r7P122tNmV6eUbPX/kifhmdKHlvN9HSkmlJ8S3511Oo6/GWT1ta+Nb+ePwY+T418+7sgsgJu/Oo1aCo4IH0VbR4Kyetnm+Wl5K7KDPjM76RzEnIQRBoTNixnksvom/xTbQmxmg0VOFT/NR4dIM4P2VtDM8Pr6Bz+79Ha+k9+RlyYKUExvwf3nOuzkussy1LTcAftR/D9syPTkP0HwrywACEFKSsFOcXXW4axdCtSfMXE81T8Y3kbHNsrsY3KBNjpol7BTrU7u5Z2wtr6a7GDbG8QkPutDwCW/OAjxpZ9iS3MMv+v/Mfw49SMJK5e2kCAmcWbmCa5oudO2aA3ghvp2fDT04cdZajt63QinbAAIYssZZWtHiyubfUyqEl/vHniNmp8vuYnCbLjQsadOZHWBdcgcPxl7k+firdGb6MG2Tem8VPs3j/GPT9uDoc/xi6EF+NfQQL6Vfy/vBg6PC5r9aP0ydZ+Zn1U2Jm0l+PnAfG9N78hak+VSy54LtD0vaHBNcyLdarqTJV+usnpYHRtfy1d4/lNVQaD5JKbGw8Qidai3AIcEOjgstY4m/hXpPiLAWIKwH3nTDdlNajFtJRs0YfVac1dGNPBbfQLcxCsi89ztJKRFC5//NfS8X1p3krJ6Rx6Mb+MzeG8nK8lsOQ7kH0ATBv869mPfVneKsOGBpO8P3em7nv8eewifcu3PPVlJKbCQmEg8aET2AV/MhNR9+zcfBnhp8wkO1CGBKiyhphs0Ye+00lpUmbSWJ2mnE5J/PZ2tnX5a0uaruLD4990JXf4cxM8Znu25gTWI7uos/t5iUfQDZUvLZxgv4cOPbnFUHrDszyCe7fsHWdE9ZzcUoVpa0/89ROTq5H8naX1JO/HYrAm38Z9s/0uCtdr5k2mxp84ehx7iu/7ayvtmV/bfIo3k4JNDuLJ6W3dkBOrNDKnzyRBcaHqH/r/+KJXymLPLN5ZvzrqDOU+WsmpE9mX5+MvwXPGWy5uvvKetvkpSSdm+da/0/Lyc7MctkRbgyM1P9Ph9rOIcF/mZXH70safProYeJmwlXf24xKusAMrE5wt9Bg3fmE8JSdpb1qd1qTZiClBITm+/P+wDnVB/lrJ6xx8c3cF/0+bKb9fxGyjqAfMLDsuB8Am8yorK/Ro1xNqd2l/cbprwlKSW60Pl0wzs4p/pI14fG+41RfjJ4P2lpFN3jZi64++4VESkltVqQo0IHOaum5ZXUHvqs2Ky4KJQ3NjXT+aO1Z3JF/RnOalf8aeQZdmb6Zk0/Y1n/Kxu9Vcz3NzuLD5ghTW4aeRRfeb9dyluwgYurj+Pque8grAec1TMipeSlxE7+MPI4sgT3WZqusv5GrQq60/oZNKI8mtrpenNbKR2mtDklvJRPzLkgJxMdu7JDfKXnDwzMslZ22X6jbOAIlx6/XkruJCxnz0Wh/A8pJZaUnBpexi86/olqT8j5khmzpM1vBh+iM9M7625yZfuvzWo6C3zurAFbn9ozK0YklP9NSokmNC6rOYlvt1zprHbN7cNPcmt0zay8xsoygKSUBPQA7f65zqpp2Zjc6SxSytzUaNdVtWfxheb35qTlw+RK9+8O3I3++l5Ws0tZBpCJzcXBQ1yZwt6THWZ3pm9W3p1mq6k1ap9sOJcPNZ6dkz4fgH5jjJ8O3ke6DM9d219lF0BSSsakxYW1JzirpuXx6Abidu7PDlcKT0qJlBKExr83X8ZVjW93fbRrStxK86PeO3k8vrXsZzu/mfILIGC5r96V4feElebp+OZZdzrqbGUDC31z+GnLR3hnzXHOalfdNPQId42vI5TnnSKLTVkG0MrAwjfdT2Z/dWcH2JDZM2smhc1WEyNdNkcHF/Cjto9yWtVhORuNsqVk9fjL/GTwz3jUg335BZCGYKW/zZU9gPdmhxly6ahnpXhpmoer6s7me60foaOiyVntqtWxl/ns3t8iEOqxvhwDSGgai4OtzuJpeT6xY7JNpZQbKSW2lGSQXDfnYj499100eKtz1h8jpWTEjPHD/nuIW6mc/T2lpqwCyJI2dXqE+b5GZ9UBS1gZtmS60fPQTJZSYkq7JI86LkVT83vOjBzKAwu/woV1J+U8ELalu/lA5w/ZWoYnW8xEWQWQBI7wtxFyYeRiT7afV9LuHfG8r6m7L4ApJQGtgmODCzgqMB8m+wkU900EvUWlHuQLjRfx3daPsMg/z/kyV0kpGTbG+erem+jM9uesb6lUldWWrKa0uXbOe3lf/akzusuY0uLu4dV8qe8P+F2YS4Rje9F5nhrmVTSwxNfEikA7B/lbqPdWYkmbJ2ObuGHkEboyA+pidZElbTSh87bIYXyg/gyWBdpyNr9nX3sy/fxrz+95LrFdfZ5voGwCyJaSaj3Iz1r/kcPCM1sDFreSXL37Jzyfem3GI2CmtBiys8zzRDg/fBgX1B5Ph6+RSk8Y/98Zgu0zRvlW7238OrqWDm3mrbnZListqvQg32m6jJMqV+B18Sigt3JZ5/d5ycVjwstNWQXQ4YEOfjX/n2e8Adm2VDen7vw3ag/gDjnVwqkQXvzCS4uvjjZ/K0cH2jkk0Mb8iib8mne/77qGNFkX38Yvh/7C+mQnWWmV7ckIuWJJmyo9wD/UnsJ7a06k2VfnfElOSCnpyg7w5Z6bVfi8hbIJIIHgospj+Ebr5c6qA3bL0ON8o+/Wt2z9WNImg0VA+DjIW8+iiiZOiRzKKVWrqHShH2rKs/GtfLP3Vl7N9KIhVFP+LZjSJqh5OSu8gi82v48aT8T5kpwaNeP8c9f1vKDWEL6lsgkgDY1/b34/59cc66w6YNfs+TUPjb/wf/qRstLCRNLiqabV18gCbwOHBxfQXjGHJp97m987SSnpM0Z4JraF+2Mv8FxiO6a0VBA5mNKi3dfIaeFDOLPyMFYGF+T1cUtKybZ0N1/dezNbMt3OauUNlE0AhTU/17d9nBWhhc6qA3bSls8zYiUQQmBIi1FpUid8vLfqWE6KHMp8fyMdFXPR9/Nxyk1xK83OdA/X9t7Cs6lO6rQK50tmHVPaRKXBJ2tO44qGM2l18SjuAzFixnh/5/fpyg46q5S/o2wCaJ63gdsWfJ6qGW6bsCczwAnbvsTBviZa/M2s8rdwdHARi/zzCOp+/ML7f1pG+SalZNxK8lhsI3+NbeDJ2MukpEnQpRG7UmBJmxQW7b4GLogcwdurjmSBf6KfLd9sKVkde5kf9t/D1kyPapkegLIIIFPaXFZ9Il+Zd+mMw2FT8jXCup9GbzU+4UGfnCo105+bC3LynPVRM87vBv/GrWOridsZbKQrS1GKkSEtAsJLnSfCtU2XckR4EX7hQxTwM3o0+hJf6rmJuJUq2O9QqsoigIbtDLd3XMOJkeXOqlmlNzvC+sQOHo9t5pVMF93ZIdIyiyjhjuuJvi6dej1MR8UcTgwezJGhRawMLUQr8L8pYaX5w/Dj/GDgHgQi57Opy1FZBJAtJZuW/7TgF2QxmGoVjZlxXkjs4OXELu6LraPTGMUvhCubtOXa1OiiV3g4NbiEE8LLWRlcwMGBVrzCUxRf9H5jjB/13sld4+vwqIWl01byAWRKmzMiK/iv9qudVQqQtQ1GrBjdmSGej29lQ2YvuzO9dGYHSWARRkcv4BfIkjYmkgw2bXoVTb56FvmaODzYwcrgAuq8VVTr4aIIHSZvdhuTu/jxwD2sSWwr20fdfCmLAPpq0/u4rO5UZ5WyDyklkomtRlN2lqiV4Pn4Nh6Lvsjv4+vxIfCjoQvQ0RCIt5wHdSDk5HHGANbk7zEiTVZ46zk7vJILa09inq+OoOZDFxO/AQXs13kjtrS5e3QN1/beiiWtognFUlbyAeQRXq5vu5qjw0ucVcoB2JPppzPTT1dmgF5zjEFjnKidYMxKkLDSJGUWS9pY0oLJzmAnXWgT0SUEXuHBi05IqyCs+6nxRKjRwzTqEZq8tbT4GlgabMvZlqduklIyYIzxy4EHuHnsKXyq1eOakg+gsB7hvoVfpMFb7axSpklKiSEtTGlhYWFJGxtJ2s6StNMYtknUTr0eRlPCmp8K4SWo+wnrAcTkBFFdaHiE/vp/pcSUNutjW/lG/13syvQUdLStHJV0ABnS4uzISr7TciVBXU3IU9y1J9PPbcNPcXt0DeNWqmRHEotZSb+jaWlzWvgQKgow+Uwpb0+Mb+QTe37JjaOPEbfSKnxypGTfVSkl8zwRFgVa1cWhuMKWNtvT3Vy79xY+3XUD2zO96pErx0r2myuBpRXzmF+gdT9KeRkzY/xh6DE+uPsn3Dr6FIY0XR0FVN5Yyb7DAlhQ0VwSoyhvxJAmw8Y4vdkRZ5WSR1EzwZPRjXy+6zdc138bo2YcXRRuXtRsU7Kd0B50/l/zJZyf4wPk3GRJm23pbrYkX2NHuoftmR76rBiXVp3AubXHznghrXJg1id2cOPQw6xObCVtZ9W8ngIo2QAKaQFu6vhnFgdanFVFwZI2Q0aUXmOE17IDrIvvYHN6N/1mlLidISmzkxP+JjZTW1LRxPtqT+H0yhU0qikFOWNJm83J17hr9GkeiL3IuJUsuakB5aQkA8iUNkcE5/PTto9T4wk7qwsiYxuk7Cx92WEeia7njsRGhsxxdDuLJU1sObEl/Rt1ak7MUp4o9+pBPlx1Apc1nFk0/7ZykLENXk118R8Dd7MhtQfLNuANPgslv0o0gCwurjqOa1suL8gIWMY2SNppxs0EuzN9bMsOsCm1m3WJbWw3o1QLDS/6tC/ujDRZ4GvkvKqjObtyJa2+RoJaxbR/3mxlSosxM85LyZ3cPrqah+Ob8KEX5JpR3lhJBlBWmvy05SrOrj7CWZUzaTvLznQvezL9bE918XRqG7uMEUw7S0Ya2FK6uqhzqsVUpYc4O3wIZ1UdzlHhJa6ceV/ubCnpzg7xeHQ9t0TX0GuMkrUN1cdThEougKSUIATPLPkulTnqtM3aBoNGlFErzrb0Xl5K7KQz28ceY5gRK05GWnjRXAubt2JKi5Dm5xB/C6dHVnJMeAltvjlq9rfDoDHG1lQ3j0TXsy65g13G4Bs+8irFo+QCyJI2RwQ6uHnhF5xVM2JKi83J11gbe4XVqW30G1FiVoK4nUEycaLm1ELLQpByYgW5V+hU6SEW+5s4L3IE51QfRUj3O18+q2xPdXHbyFM8k9xBrzFMVppYUqoWTwkouQDKSIsvzL2Yj9Sf4ax6S1OLLLPSYNSMs9cYYWd2gDWxl3kmsZW9VpKI0PFOLqAsZpa0iUuLWj3AOyqP4MzKlSzyz6NGD+PXfEX/+0+HlJKMNEhYafqMUZ5PbOdPo2t4OrOHWuFRe/OUoJILIJ/w8NPWj3F8ZJmz6g1NbeDenx2mzxzjpcROnk3tYLcxQtJKErPTeJnYRqIU75gT++xI/MJD2BNmeUUTp4cPZYm/lfaKBqo8kZIPo7Rt0G+MsDvTx1PjL/Ncejf9xihjVhK9RD83ZULJBVC1p4pbOq6htaLBWQWTI1RjVpxxM86m1B62prrYle1jS6aHHmMMTQh86GV70U61jOr0AEsrmljsm8eyQCvLg/Op9oSo1kOENH/BHiXfiiFNYmaSuJWkM9PHplQXWzPd7Ej3sDXbj09oqqVTRkoqgExpc3JkOT9pvep/jQZZ0mZdfBvrEq+yJdtLV2aQXnOMrG1gSBMbOes2DZ/qM5oIXA9ezUu1HqTdV0+TXs0ifzNLAx0s8jcXdAa2lJK92SE2J3ezI72XbUY/A8YYe4xh0nYWQ5oY0pp1n99sUVIBlJYm1815HydXHkqPOcbLqT2si2/hycRWstJAn5xXrBYR/n22lNj7bI0qgQ5PLW2+Rg7ytzLfP5d53lrCmo9KzY9X8xLUKtCYaHn4NO/r26W+EclEP5stbTLSJCMNDDtLSprE7QwD5jjdmUF6s0NsSu1mc6Ybk4lL0DP5c9XM5NmjpALIkjYLK5pJyix9xggpaVKB5ur8m9loIpQkWWzkZBAEhZew5kfXvAQ0PwgNWwgqhAcNQaXw/p+DEIdlhqy0ycqJXZ9t28SUBrZtkrGzJGSGxOSNQkOgl/BxQYo7SiqAFEUpL+r2oyhKwagAUhSlYFQAKYpSMCqAFEUpGBVAiqIUjAogRVEKRgWQoigFowJIUZSCUQGkKErBqABSFKVgVAApilIwKoAURSkYFUCKohSMCiBFUQpGBZCiKAWjAkhRlIJRAaQoSsGoAFIUpWBUACmKUjAqgBRFKRgVQIqiFIwKIEVRCkYFkKIoBaMCSFGUglEBpChKwagAUhSlYFQAKYpSMCqAFEUpGBVAiqIUjAogRVEKRgWQoigFowJIUZSCUQGkKErBqABSFKVgVAApilIwKoAURSkYFUCKohSMCiBFUQrm/wMcRwNRqKT7hgAAAABJRU5ErkJggg==" alt="WhatsApp" /></span>
  <span class="waTooltip" id="waTooltip">💬 Chat with us!</span>
</a>

<header>
  <div class="logo">
    <img class="logoDot" src="/haivisitor.png" alt="Hai Visitor logo" />
    <div>Zodopt's Hai Visitor<span>Visitor Management Platform</span></div>
  </div>
  <nav>
    <a href="#features-section">Features</a><a href="#Plans">Pricing</a><a href="#how-it-works">How It Works</a><a href="#industries-section">Industries</a><a href="#faq">FAQ</a>
  </nav>
  <div class="headerAuth">
    <a class="btnSignin" href="https://www.promeet.zodopt.com/auth/login" target="_blank" rel="noopener noreferrer">Sign In</a>
    <a class="btnSignup" href="https://www.promeet.zodopt.com/auth/register" target="_blank" rel="noopener noreferrer">Sign Up</a>
  </div>
  <button class="hamburger" id="hamburger" aria-label="Toggle navigation">
    <span></span><span></span><span></span>
  </button>
</header>
<nav class="mobileNav" id="mobileNav">
  <a href="#features-section">Features</a>
  <a href="#Plans">Pricing</a>
  <a href="#how-it-works">How It Works</a>
  <a href="#industries-section">Industries</a>
  <a href="#faq">FAQ</a>
  <div class="headerAuth" style="display:flex;">
    <a class="btnSignin" href="https://www.promeet.zodopt.com/auth/login" target="_blank" rel="noopener noreferrer">Sign In</a>
    <a class="btnSignup" href="https://www.promeet.zodopt.com/auth/register" target="_blank" rel="noopener noreferrer">Sign Up</a>
  </div>
</nav>


<section class="hero gridBg" aria-label="Hero">
  <div class="heroGlow heroGlow1"></div>
  <div class="heroGlow heroGlow2"></div>

  <div class="heroBrandBlock">
    <p class="heroBrandLabel"><span class="heroBrandLine"></span>Zodopt's<span class="heroBrandLine"></span></p>
    <h1>Hai Visitor</h1>
  </div>

  <h2>You spend money bringing customers in.<br><span class="heroAccent">Don't let their data walk out.</span></h2>
  <p>Hai Visitor connects the walk-ins generated by your marketing to an organised digital visitor database — so your team has a stronger foundation for future WhatsApp communication and eligible customer-list advertising.</p>
  <ul class="heroChecks">
    <li>QR-based customer registration with no dedicated hardware</li>
    <li>Instant WhatsApp notification to the relevant team member</li>
    <li>Digital visitor records, history, dashboard visibility and reports</li>
  </ul>
  <div class="heroButtons">
    <a class="btnPrimary" href="https://promeet.zodopt.com/auth/register" target="_blank" rel="noopener noreferrer">Start 15-Day Trial for ₹49 →</a>
  </div>
</section>
<section class="trustStrip">
  <div class="container">
    <div class="trustBar" id="trustBar"></div>
  </div>
</section>
<section class="dashboardGlass gridBg" id="how-it-works">
  <div class="container dashboardInner">
    <div class="dashboardTextCol">
      <div class="dashboardText">
        <h2>Smart Visitor Check-In <span>Experience</span></h2>
        <p>See how Hai Visitor transforms visitor registration into a smooth digital journey. Visitors register in seconds, receive their digital pass instantly on WhatsApp, and enjoy a faster, hassle-free entry experience.</p>
      </div>
      <div class="stepsFlow" id="stepsFlow">
        <svg class="stepsFlowLine" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="stepsFlowGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style="stop-color:var(--orange)"/>
              <stop offset="100%" style="stop-color:var(--pink)"/>
            </linearGradient>
          </defs>
          <path d="M5,72 C16,42 20,30 27,30 C38,30 40,72 50,72 C60,72 65,30 73,30 C84,30 90,24 95,22" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
    <div class="vpImages" onclick="window.open('https://www.promeet.zodopt.com/auth/login','_blank')">
      <img class="vpImgLeft" src="/2secimage.png" alt="Front desk visitor check-in">
    </div>
  </div>
</section>
<section class="leakSection">
  <div class="wrap">
    <div class="leakGlass">
      <h2>Your marketing brings them in. <span class="accent">What happens after they enter?</span></h2>
      <div class="split">
        <div>
          <p class="lede">Meta ads, Google campaigns, influencer promotions and seasonal offers may successfully create showroom footfall. But if the visit is not digitally registered, that customer becomes a missing link in your marketing funnel.</p>
          <div class="points">
            <div class="point"><em>◎</em><span>Your campaigns have already paid to bring attention into the showroom.</span></div>
            <div class="point"><em>↗</em><span>Without structured registration, the relationship may end at the door.</span></div>
            <div class="point"><em>□</em><span>Scattered or incomplete data weakens future communication.</span></div>
            <div class="point"><em>↻</em><span>You may spend again to reach people who already visited.</span></div>
          </div>
          <div class="highlight">The real leakage is not only a missed sale today. It is a customer relationship your future marketing may never be able to use.</div>
        </div>
        <div>
          <img class="leakImg" src="/img.png" alt="Promotions bring customers in, but they leave with no record captured">
          <div class="media-label"><span>Marketing</span><span class="mediaArrow">→</span><span>Walk-In</span><span class="mediaArrow">→</span><span>Data Gap</span></div>
        </div>
      </div>
    </div>
  </div>
</section>
<section class="howItWorks gridBg">
  <div class="container everyVisit">
    <div class="visitMedia">
      <div class="photoCard">
        <img src="/section4.jpeg" alt="Manual register records">
        <div class="mediaLabel"><span>Manual records</span><span class="mediaArrow">→</span><span>Organised database</span></div>
      </div>
    </div>
    <div class="visitCopy">
      <h2 class="visitTitle">Scattered Data, <span>Missed Opportunities</span></h2>
      <p class="visitLede">Customer information spread across paper registers, spreadsheets, notebooks and individual salespeople is difficult to search, review and use consistently.</p>
      <div class="visitPoints" id="visitPoints"></div>
    </div>
  </div>
</section>
<section class="everythingSection gridBg" id="industries-section">
  <div class="container">
    <h2 class="title">One Platform. <span>Every Showroom.</span></h2>
    <p class="subtitle">Ensure every walk-in visitor is registered so you can follow up effectively and convert more visitors into customers.</p>
  </div>
  <div class="segmentsScroller">
    <div class="segmentsTrack" id="segments"></div>
  </div>
  <div class="container">
    <a class="ctaBtn" href="https://www.promeet.zodopt.com/auth/login" target="_blank" rel="noopener noreferrer">Get Started Today ↗</a>
  </div>


</section>
<section class="industriesSection gridBg" id="features-section">
  <div class="container">
    <h2 class="industryTitle">Simple enough to start quickly. <span>Useful enough to replace manual chaos.</span></h2>
    <ul class="industryGrid" id="industries"></ul>
    <div class="screensRow">
      <div class="flipCard">
        <div class="flipInner">
          <div class="flipFace"><img src="/pic (1).jpeg" alt="Hai Visitor feature screenshot 1" loading="lazy"></div>
          <div class="flipFace flipBack"><img src="/pic (2).jpeg" alt="Hai Visitor feature screenshot 2" loading="lazy"></div>
        </div>
      </div>
      <img src="/pic (3).jpeg" alt="Hai Visitor feature screenshot 3" loading="lazy">
    </div>
  </div>


</section>
<section class="pricingSection gridBg" id="Plans">
  <span class="pricingGlow g1"></span>
  <span class="pricingGlow g2"></span>
  <h2 class="pricingTitle">Find the <span>Right Plan</span>.</h2>
  <p class="pricingSubtitle">Choose the perfect plan for your organization. All plans include core features with scalable options.</p>
  <div class="pricingCards" id="pricing"></div>
</section>
<section class="testimonialsSection gridBg" id="testimonials-section">
  <div class="testimonialsCard">
    <h2 class="sectionTitle">A customer may leave today.<br><span>Their visit record doesn't have to.</span></h2>
    <p class="sectionSubtitle">Every registered walk-in becomes one organised, retrievable record — the foundation your team can use to re-engage customers and power future marketing.</p>
    <div class="trustPoints" id="trustPoints"></div>
    <div class="trustHighlight">Hai Visitor organises every visit into one database — so your team can act today and market smarter tomorrow.</div>
  </div>
</section>
<section class="faqSection gridBg" id="faq">
  <div class="faqContainer">
    <h2 class="faqTitle">Everything a showroom owner needs to know <span>before starting.</span></h2>
    <div class="faqGrid" id="faqGrid"></div>
    <div class="faqCta">
      <h3>Your marketing has already brought the customer in.<br><span class="accent">Make the visit count beyond today.</span></h3>
      <p>Replace fragmented walk-in records with a simple digital visitor-management foundation that your team can retrieve, review and responsibly use.</p>
      <div class="faqCtaButtons">
        <a class="finalBtn primary" href="https://promeet.zodopt.com/auth/register" target="_blank" rel="noopener noreferrer">Start 15-Day Trial for ₹49 →</a>
        <a class="finalBtn wa" href="https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Hai Visitor+-+Visitor+Management+Platform" target="_blank" rel="noopener noreferrer">Chat with the Hai Visitor Team</a>
      </div>
    </div>
  </div>


</section>
<section class="getStarted gridBg">
  <div class="gsContainer">
    <div class="gsLeft">
      <h2>Get Started with <span>Zodopt's Hai Visitor Today</span></h2>
      <p>Reach out to the Hai Visitor team directly.</p>
      <div class="gsRight" id="gsRight"></div>
    </div>
    <div class="trustGlass aiGlassCol">
      <h2 class="finalTitle">Build the structured data foundation your <span class="accent">future marketing intelligence needs.</span></h2>
      <p class="finalLede">Hai Visitor turns showroom visits into a structured data foundation for future AI-driven marketing.</p>
      <div class="aiLayerGrid" id="aiLayerGrid"></div>
    </div>
  </div>
</section>

<footer class="footer gridBg">
    <div class="footerTop">
    <div class="footerBrand">
      <div class="logoWrap">
        <img class="logoDot" src="/haivisitor.png" alt="Hai Visitor logo" />
        <div><h3>Zodopt's Hai Visitor</h3><span>Visitor Management Platform</span></div>
      </div>
      <p>A platform designed to digitalize organization entry management, streamline conference bookings and ensure a professional visitor experience.</p>
      <div class="footerCta">
        <a class="btnPrimary" href="https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Hai Visitor+-+Visitor+Management+Platform" target="_blank" rel="noopener noreferrer">WhatsApp →</a>
        <a class="btnSecondary" href="mailto:admin@promeet.zodopt.com">Email →</a>
      </div>
    </div>
    <div class="footerLinks">
      <h4>Key Features</h4>
      <ul id="footerFeatures"></ul>
    </div>
    <div class="footerLinks">
      <h4>Industries</h4>
      <ul id="footerIndustries"></ul>
    </div>
  </div>
  <div class="footerBottom">
    <span>© 2026 Zodopt's Hai Visitor. All rights reserved.</span>
    <a href="https://zodopt.com/about-us/" target="_blank" rel="noopener noreferrer">© Zodopt</a>
    <div class="footerLinksInline">
      <a href="https://zodopt.com/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      <a href="https://zodopt.com/terms-and-conditions/" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>
    </div>
  </div>
</footer>



<div class="offerTicker"><div class="otTrack"><span>₹49 ONLY — 15-DAY TRIAL</span><span class="otStar">★</span><span>NO HARDWARE NEEDED</span><span class="otStar">★</span><span>GO LIVE IN 15 MINUTES</span><span class="otStar">★</span><span>INSTANT WHATSAPP ALERTS</span><span class="otStar">★</span><span>BUILD YOUR CUSTOMER DATABASE</span><span class="otStar">★</span><span>₹49 ONLY — 15-DAY TRIAL</span><span class="otStar">★</span><span>NO HARDWARE NEEDED</span><span class="otStar">★</span><span>GO LIVE IN 15 MINUTES</span><span class="otStar">★</span><span>INSTANT WHATSAPP ALERTS</span><span class="otStar">★</span><span>BUILD YOUR CUSTOMER DATABASE</span><span class="otStar">★</span></div></div>


`;

export default function HomePage() {
  useEffect(() => {

  /* Trust strip stats */
  const trustStats = [
    { value:'₹49', label:'15-day paid trial' },
    { value:'15 Minutes', label:'Approximate setup time' },
    { value:'No Hardware', label:'Display the QR code' },
    { value:'AWS', label:'Cloud-hosted platform' },
  ];
  const trustBarEl = document.getElementById('trustBar');
  if (trustBarEl) {
    trustBarEl.innerHTML = trustStats.map((t, i) => `
      ${i > 0 ? '<div class="trustDivider"></div>' : ''}
      <div class="trustItem"><h3>${t.value}</h3><p>${t.label}</p></div>`).join('');
  }

  /* Dashboard "how it works" step flow */
  const stepsFlowData = [
    { left:5,  top:72, dir:'Down', text:'Customer scans the showroom QR code or opens the registration link.' },
    { left:27, top:30, dir:'Up',   text:'Customer submits the required visitor details.' },
    { left:50, top:72, dir:'Down', text:'The relevant team member receives a WhatsApp notification.' },
    { left:73, top:30, dir:'Up',   text:'The visitor entry becomes part of the digital visitor history.' },
    { left:95, top:22, dir:'Down', text:'Authorised users access dashboard visibility and reports.' },
  ];
  const stepsFlowEl = document.getElementById('stepsFlow');
  if (stepsFlowEl) {
    stepsFlowEl.querySelectorAll('.stepsFlowNode').forEach(n => n.remove());
    stepsFlowData.forEach((s, i) => {
      const node = document.createElement('div');
      node.className = 'stepsFlowNode';
      node.setAttribute('style', `left:${s.left}%;top:${s.top}%;`);
      node.innerHTML = `<span class="stepsFlowDot">${i + 1}</span><div class="stepsFlowCallout stepsFlowCallout${s.dir}">${s.text}</div>`;
      stepsFlowEl.appendChild(node);
    });
  }

  /* "Scattered Data, Missed Opportunities" points */
  const visitPointsData = [
    { icon:'✕', text:'Difficult to retrieve, review and use later.' },
    { icon:'✕', text:'Customer information lives in multiple disconnected places.' },
    { icon:'✕', text:'Business visibility depends on the person who handled the enquiry.' },
    { icon:'✕', text:'Management cannot easily review registered visits and history.' },
  ];
  const visitPointsEl = document.getElementById('visitPoints');
  if (visitPointsEl) {
    visitPointsEl.innerHTML = visitPointsData.map(v => `<div class="visitPoint"><span class="visitEm">${v.icon}</span><span>${v.text}</span></div>`).join('');
  }

  /* "A customer may leave today" trust points */
  const trustPointsData = [
    { icon:'◍', text:'Retrievable visitor history instead of paper or memory.' },
    { icon:'✆', text:'Re-engage consented customers through your WhatsApp workflow.' },
    { icon:'↗', text:'Upload eligible consented lists to ad platforms, per policy.' },
    { icon:'✦', text:'Every visit strengthens the database instead of starting from zero.' },
  ];
  const trustPointsEl = document.getElementById('trustPoints');
  if (trustPointsEl) {
    trustPointsEl.innerHTML = trustPointsData.map(t => `<div class="trustPoint"><em>${t.icon}</em><span>${t.text}</span></div>`).join('');
  }

  /* Get Started contact cards */
  const emailSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
  const whatsappSvg = '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.82 2.42a8.19 8.19 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.55 3.7-8.24 8.25-8.24m-4.53 4.7c-.15 0-.4.06-.61.29-.21.24-.8.78-.8 1.9 0 1.13.82 2.22.93 2.37.11.16 1.6 2.55 3.97 3.51 1.97.79 2.37.63 2.8.6.43-.04 1.38-.57 1.58-1.11.19-.55.19-1.02.13-1.11-.06-.1-.21-.15-.43-.27-.23-.11-1.38-.68-1.6-.76-.21-.08-.37-.11-.53.11-.15.23-.6.76-.74.92-.14.15-.27.17-.5.06-.23-.12-.97-.36-1.86-1.15-.68-.61-1.15-1.36-1.28-1.59-.14-.23-.02-.35.1-.47.1-.1.23-.27.34-.4.11-.14.15-.24.23-.4.08-.15.04-.29-.02-.4-.06-.12-.53-1.29-.74-1.76-.19-.46-.39-.4-.53-.4z"/></svg>';
  const gsCards = [
    { cls:'emailCard', href:'mailto:admin@promeet.zodopt.com', icon:emailSvg, title:'Send us an email', desc:"We'll get back to you shortly." },
    { cls:'whatsappCard', href:'https://wa.me/916366834745?text=Hi%2C+Can+i+know+more+about+Hai Visitor+-+Visitor+Management+Platform', target:true, icon:whatsappSvg, title:'Chat on WhatsApp', desc:'Get instant answers from our team' },
  ];
  const gsRightEl = document.getElementById('gsRight');
  if (gsRightEl) {
    gsRightEl.innerHTML = '';
    gsCards.forEach(c => {
      const a = document.createElement('a');
      a.className = `gsCard ${c.cls}`;
      a.href = c.href;
      if (c.target) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.innerHTML = `<span class="gsCardIcon">${c.icon}</span><span class="gsCardText"><h3>${c.title}</h3><p>${c.desc}</p></span>`;
      gsRightEl.appendChild(a);
    });
  }

  /* AI data-foundation layer grid */
  const aiLayers = [
    { icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M20 8V5a1 1 0 0 0-1-1h-3"/><path d="M4 16v3a1 1 0 0 0 1 1h3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><rect x="8" y="9" width="8" height="6" rx="1"/></svg>', title:'Consented visitor registration', desc:'Name, phone and visit details', tag:'Capture' },
    { icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3"/></svg>', title:'Organised visitor records', desc:'One source for your team', tag:'Organise' },
    { icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4.1-1.05L3 20l1.05-5.4A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5z"/></svg>', title:'Team-led WhatsApp use', desc:'Consent-based outreach', tag:'Activate' },
    { icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="#fff"/></svg>', title:'Eligible advertising audiences', desc:'Subject to platform policies', tag:'Retarget' },
  ];
  const aiLayerGridEl = document.getElementById('aiLayerGrid');
  if (aiLayerGridEl) {
    aiLayerGridEl.innerHTML = aiLayers.map(l => `
      <div class="aiLayer"><span class="aiChip">${l.icon}</span><h3>${l.title}</h3><p>${l.desc}</p><span class="aiTag">${l.tag}</span></div>`).join('');
  }

  /* Footer feature links */
  const footerFeatures = ['Digital Visitor Passes', 'Live Dashboard', 'Conference Booking', 'Email & WhatsApp Alerts', 'Multi-location Support', 'Analytics & Reports'];
  const footerFeaturesEl = document.getElementById('footerFeatures');
  if (footerFeaturesEl) {
    footerFeaturesEl.innerHTML = footerFeatures.map(f => `<li><a href="#features" style="color:inherit;text-decoration:none;display:block">${f}</a></li>`).join('');
  }

  const segments = [
    { img:'/bridal-jewellery.jpg', title:'Bridal & Jewellery', desc:'Bridal couture, gold and diamond jewellery showrooms with high-value, appointment-led purchase journeys.' },
    { img:'/automobile.jpg', title:'Premium Automobile', desc:'Car and bike dealerships with enquiry-led, assisted purchase journeys.' },
    { img:'/home-interiors.jpg', title:'Home & Interiors', desc:'Furniture, modular kitchen, tiles, lighting and interior showrooms.' },
    { img:'/offices.jpg', title:'Offices', desc:'Corporate offices, co-working spaces, professional firms and enterprise setups.' },
  ];
  const segmentsEl = document.getElementById('segments');
  if (segmentsEl) {
    segmentsEl.innerHTML = segments.map(s => `
      <div class="segmentCard">
        <div class="segmentImgWrap"><img src="${s.img}" alt="${s.title}" loading="lazy"></div>
        <div class="segmentBody"><h3>${s.title}</h3><p>${s.desc}</p></div>
      </div>`).join('');
  }

  const buildingSvg = (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="18"/><rect x="13" y="8" width="8" height="13"/><line x1="7" y1="8" x2="7" y2="8.01"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="17" y1="12" x2="17" y2="12.01"/><line x1="17" y1="16" x2="17" y2="16.01"/></svg>`;
  const industries = [
    { color:'blue', hex:'#3b82f6', title:'QR Registration', desc:'Walk-in and pre-registration workflows.' },
    { color:'violet', hex:'#7c3aed', title:'WhatsApp Notification', desc:'Alert the person selected by the visitor.' },
    { color:'green', hex:'#16a34a', title:'Digital Visitor Pass', desc:'Delivered through WhatsApp after registration.' },
    { color:'amber', hex:'#f59e0b', title:'Visitor History', desc:'Retrieve registered visit information.' },
    { color:'red', hex:'#dc2626', title:'Check-In / Check-Out', desc:'Maintain entry and exit records.' },
    { color:'sky', hex:'#0284c7', title:'Dashboard & Reports', desc:'Review visitors, hosts and consolidated activity.' },
    { color:'blue', hex:'#3b82f6', title:'Conference Booking', desc:'Manage meeting rooms within the platform.' },
    { color:'violet', hex:'#7c3aed', title:'Multi-Location Support', desc:'Available with current product limitations.' },
    { color:'green', hex:'#16a34a', title:'No Dedicated Hardware', desc:'The minimum setup is a displayed QR code.' },
  ];
  const industriesEl = document.getElementById('industries');
  industriesEl.innerHTML = '';
  industries.forEach((ind, i) => {
    const el = document.createElement('li');
    el.className = 'featItem';
    el.setAttribute('style', '--d:' + (0.15 + i * 0.3) + 's');
    el.innerHTML = `<span class="featTick"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span><div><h3>${ind.title}</h3><p>${ind.desc}</p></div>`;
    industriesEl.appendChild(el);
  });
  const footerIndustriesEl = document.getElementById('footerIndustries');
  const footerIndustries = [
    { title:'Corporates' },
    { title:'IT Parks' },
    { title:'Co-working Spaces' },
    { title:'Manufacturing Units' },
    { title:'Enterprises' },
    { title:'Educational Institutions' },
  ];
  footerIndustriesEl.innerHTML = '';
  footerIndustries.forEach(ind => {
    const li = document.createElement('li');
    li.innerHTML = '<a href="#industries" style="color:inherit;text-decoration:none;display:block">' + ind.title + '</a>';
    footerIndustriesEl.appendChild(li);
  });

  const rocketSvg = (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c2.8 1.4 4.8 4.2 4.8 8.5 0 2.5-.8 4.8-1.8 6.5H9c-1-1.7-1.8-4-1.8-6.5 0-4.3 2-7.1 4.8-8.5z"/><circle cx="12" cy="10" r="1.8"/><path d="M9 17.5l-2.5 3.5"/><path d="M15 17.5l2.5 3.5"/><path d="M7.2 13c-1.5.3-2.7 1.3-3.2 3 1.7.4 3.2 0 4.3-1"/><path d="M16.8 13c1.5.3 2.7 1.3 3.2 3-1.7.4-3.2 0-4.3-1"/></svg>`;
  const clockPlanSvg = (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`;
  const buildingPlanSvg = (color) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="18"/><rect x="13" y="8" width="8" height="13"/><line x1="7" y1="8" x2="7" y2="8.01"/><line x1="7" y1="12" x2="7" y2="12.01"/><line x1="17" y1="12" x2="17" y2="12.01"/><line x1="17" y1="16" x2="17" y2="16.01"/></svg>`;
  const checkIconSvg = (color) => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
  const plans = [
    { name:'Trial', tag:'15-Day Trial', price:'₹49', period:'15 days', duration:'Perfect for testing the platform', popular:false, icon:clockPlanSvg, accent:'#ff6a00',
      features:['Valid for 15 days','100 Visitor Bookings','100 Conference Bookings','2 Conference Rooms'], cta:'Get Started' },
    { name:'Business', tag:'Most Popular', price:'₹500', period:'month', duration:'Ideal for growing organizations', popular:true, icon:rocketSvg, accent:'#7c3aed',
      features:['Unlimited Visitors','1000 Conference Bookings/month','Up to 6 Conference Rooms','Advanced Analytics & Reports'], cta:'Get Started' },
    { name:'Enterprise', tag:'For Large Teams', price:'Custom', period:'', duration:'For large organizations', popular:false, icon:buildingPlanSvg, accent:'#ec4899',
      features:['Unlimited Visitors','Unlimited Conference Bookings','Unlimited Conference Rooms','Customised Support'], cta:'Start 15-Day Trial' },
  ];
  const featureAccents = ['#7c3aed','#ff6a00','#ec4899','#7c3aed'];
  const pricingEl = document.getElementById('pricing');
  pricingEl.innerHTML = '';
  plans.forEach(p => {
    const el = document.createElement('div');
    el.className = `pricingCard${p.popular ? ' featured' : ''}`;
    el.style.setProperty('--plan-accent', p.accent);
    el.innerHTML = `
      ${p.price === '₹49' ? '<span class="burst">JUST ₹49</span>' : ''}
      <div class="planTag"><span class="planTagIcon" style="color:${p.accent}">${p.icon('currentColor')}</span>${p.tag}</div>
      <h3 class="planName">${p.name}</h3>
      <div class="planPrice">${p.price}${p.period ? `<span> / ${p.period}</span>` : ''}</div>
      <ul class="planFeatures">${p.features.map((f,i) => `<li><span class="checkIcon" style="--icon-bg:${featureAccents[i % featureAccents.length]}">${checkIconSvg('#fff')}</span>${f}</li>`).join('')}</ul>
      <a class="planCta" href="https://www.promeet.zodopt.com/auth/register" target="_blank" rel="noopener noreferrer">${p.cta}</a>
      <div class="planMicro">${p.price === '₹49' ? 'Paid trial · No refund · Product terms apply' : 'Terms apply'}</div>`;
    pricingEl.appendChild(el);
  });




  const faqs = [
    { q:'Do we need to purchase any hardware?', a:'No dedicated hardware is required. The confirmed minimum setup is to display the Hai Visitor QR code for visitors to scan with their phone.' },
    { q:'How quickly can we start using Hai Visitor?', a:'The standard setup can be completed in approximately 15 minutes, including account creation, user or host setup, QR generation and room configuration. Larger enterprise requirements may take longer.' },
    { q:'Does Hai Visitor automatically run WhatsApp marketing or ads?', a:'No. Hai Visitor captures and organises registered visitor information. Your authorised team may use consented data in separate WhatsApp or advertising workflows, subject to applicable law and each platform\u0027s policies.' },
    { q:'Can Hai Visitor track what a customer wanted or whether they purchased?', a:'These are not confirmed standard capabilities. Hai Visitor records the visitor information and visit workflow supported by the product; it should not be presented as a purchase-intent or sales-conversion tracker.' },
    { q:'What happens after the 15-day trial?', a:'The confirmed Business plan is ₹500 per month. A 10-day buffer period follows the trial before moving to the Business plan. Final billing and renewal terms should be shown at checkout.' },
    { q:'Can we use Hai Visitor across multiple locations?', a:'Multi-location support is available, with limitations. Pricing is indicated per location, and the exact configuration should be confirmed for your business.' },
  ];
  const faqAccentColors = ['#7c3aed','#ff6a00','#ec4899','#4f6df5','#0d9488','#d97706','#059669','#2a1150'];

  const faqGrid = document.getElementById('faqGrid');
  faqGrid.innerHTML = '';

  function buildFaqItem(faq) {
    const item = document.createElement('div');
    item.className = 'faqItem';
    item.innerHTML = `
      <div class="faqItemHead">
        <h4>${faq.q}</h4>
      </div>
      <div class="faqItemAnswer">${faq.a}</div>
    `;
    const answer = item.querySelector('.faqItemAnswer');
    item.addEventListener('mouseenter', () => {
      item.classList.add('open');
      answer.classList.add('open');
    });
    item.addEventListener('mouseleave', () => {
      item.classList.remove('open');
      answer.classList.remove('open');
    });
    return item;
  }

  faqs.forEach(faq => faqGrid.appendChild(buildFaqItem(faq)));

  /* Floating WhatsApp tooltip */
  const waBtn = document.getElementById('floatingWa');
  const waTooltip = document.getElementById('waTooltip');
  let waAutoHideTimer;
  const waTimer = setTimeout(() => {
    waTooltip.classList.add('waTooltipVisible');
    waAutoHideTimer = setTimeout(() => waTooltip.classList.remove('waTooltipVisible'), 5000);
  }, 3000);
  waBtn.addEventListener('mouseenter', () => {
    clearTimeout(waAutoHideTimer);
    waTooltip.classList.add('waTooltipVisible');
  });
  waBtn.addEventListener('mouseleave', () => {
    waTooltip.classList.remove('waTooltipVisible');
  });

  /* ── Auto-flip screenshot card every 5s ─────────── */
  const flipCard = document.querySelector('.flipCard');
  if (flipCard) {
    setInterval(() => {
      const inner = flipCard.querySelector('.flipInner');
      inner.style.transform = inner.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
    }, 5000);
  }

  /* ── Hamburger Menu ──────────────────────────────── */
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileNav.classList.toggle('open');
      const isOpen = mobileNav.classList.contains('open');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      document.body.classList.toggle('navOpen', isOpen);
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
        document.body.classList.remove('navOpen');
      });
    });
  }

  }, []);

  return <div dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
