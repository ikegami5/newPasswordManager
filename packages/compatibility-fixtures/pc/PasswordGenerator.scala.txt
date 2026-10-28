package passwordManagerMain

import java.math.BigInteger
import java.security.MessageDigest

import scala.util.Random
import passwordManagerMain.LineSeparators._

// The legacy calculation is shared by the GUI and headless compatibility tests.
object PasswordGenerator {
  def generate(masterPassword: String, record: Record, salt: String): String = {
    def hash(str: String, saltIsBack: Boolean): String = {
      val md = MessageDigest.getInstance("SHA-512")
      val saltyStr = if (saltIsBack) str + salt else salt + str
      md.update(saltyStr.getBytes)
      val byteArray = md.digest()
      val buffer = new StringBuffer
      for (byte <- byteArray) {
        val binaryStr = Integer.toBinaryString(byte & 0xff)
        buffer.append("0" * (8 - binaryStr.length)).append(binaryStr)
      }
      buffer.toString
    }
    val hashTwice: String => String = (x: String) => hash(hash(x, saltIsBack = true), saltIsBack = false)
    val hash8times: String => String = (hashTwice compose hashTwice) compose (hashTwice compose hashTwice)
    val hash32times: String => String = (hash8times compose hash8times) compose (hash8times compose hash8times)
    val hash64times: String => String = hash32times compose hash32times
    val hashedString = hash64times(masterPassword)
    def arrangeInPasswordFormat(str: String): String = {
      val passwordLength: Int = record.lengthOfPassword
      val initialSeed = Integer.parseInt(str.substring(456, 484), 2) + Integer.parseInt(str.substring(484), 2)
      val alphabets = ('a' to 'z').toList.mkString
      val capitalAlphabets = if (record.passwordHasCapital) alphabets.toUpperCase else ""
      val numerals = if (record.passwordHasNumeral) "0123456789" else ""
      val symbols = record.symbolsInPassword
      def lettersList(seed: Int): List[String] = {
        Random.setSeed(seed)
        Random.shuffle((alphabets + capitalAlphabets + numerals + symbols).toList.map((_: Char).toString))
      }
      for (addSeed <- 0 to 100) {
        val tmpPassword = (for (i <- 0 until passwordLength) yield {
          val wordLength: Int = str.length / passwordLength
          val wordString = str.substring(wordLength * i, wordLength * i + wordLength - 1)
          val tmpLettersList = lettersList(initialSeed + addSeed)
          tmpLettersList((BigInt(new BigInteger(wordString, 2)) % tmpLettersList.length).toInt)
        }).mkString
        def isProperPassword: Boolean = {
          (tmpPassword matches ".*[a-z].*") &&
            (if (record.passwordHasCapital) (tmpPassword matches (".*[" + capitalAlphabets + "].*")) else true) &&
            (if (record.passwordHasNumeral) (tmpPassword matches (".*[" + numerals + "].*")) else true) &&
            (if (symbols.isEmpty()) true else (tmpPassword matches (".*[" + symbols.replaceAll("[\\Q-/\\^$*+?.()|[]{}\\E]", "\\\\$0") + "].*")))
        }
        if (isProperPassword) return tmpPassword
      }
      throw new Exception("パスワードが生成できなかったよ" + lineSeparator + "パスワード変更を試してみてね")
    }
    arrangeInPasswordFormat(hashedString)
  }
}
